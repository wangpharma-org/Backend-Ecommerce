import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { HttpService } from '@nestjs/axios';
import { FailedEntity } from '../failed-api/failed-api.entity';
import { ProductEntity } from '../products/products.entity';
import { DataSource } from 'typeorm';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import axios from 'axios';
import { Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { SaleLogEntity } from './salelog-order.entity';
import { PromotionRewardEntity } from 'src/promotion/promotion-reward.entity';
import { UserEntity } from 'src/users/users.entity';
import { CompanyDayAnalyticService } from 'src/company-day-analytic/company-day-analytic.service';
import { PromotionService } from 'src/promotion/promotion.service';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { HappyHourService } from 'src/happy-hour/happy-hour.service';

interface CountSale {
  pro_code: string;
  order_count: number;
}

@Injectable()
export class ShoppingOrderService {
  private readonly slackUrl = process.env.SLACK_WEBHOOK_URL || '';
  private readonly logger = new Logger(ShoppingOrderService.name);
  constructor(
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadEntity: Repository<ShoppingHeadEntity>,
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepo: Repository<ShoppingOrderEntity>,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly httpService: HttpService,
    @InjectRepository(FailedEntity)
    private readonly failedEntity: Repository<FailedEntity>,
    @InjectRepository(ProductEntity)
    private readonly productEntity: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    @InjectRepository(SaleLogEntity)
    private readonly saleLogEntity: Repository<SaleLogEntity>,
    @InjectRepository(PromotionRewardEntity)
    private readonly promotionRewardEntity: Repository<PromotionRewardEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly promotionTierRepo: Repository<PromotionTierEntity>,
    private readonly companyDayAnalyticService: CompanyDayAnalyticService,
    private readonly promotionService: PromotionService,
    private readonly happyHourService: HappyHourService,
  ) {}

  private convertEnumToUnitName(
    unitEnum: 1 | 2 | 3 | string,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): string {
    if (!productUnits || productUnits.length === 0) {
      return '';
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.unit_name || String(unitEnum);
  }

  private getRatioFromUnits(
    unitEnum: 1 | 2 | 3 | string,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): number {
    if (!productUnits || productUnits.length === 0) {
      return 1;
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.ratio || 1;
  }

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  async countSaleAmount() {
    try {
      const result: CountSale[] = await this.shoppingOrderRepo
        .createQueryBuilder('o')
        .select('o.pro_code', 'pro_code')
        .addSelect('COUNT(*)', 'order_count')
        .groupBy('o.pro_code')
        .getRawMany();

      await Promise.all(
        result.map(async (item) => {
          await this.productEntity.update(
            { pro_code: item.pro_code },
            { pro_sale_amount: item.order_count },
          );
        }),
      );
    } catch {
      throw new Error('Something Error in countSaleAmount');
    }
  }

  async sendDataToOldSystem(soh_running: string) {
    let data;
    try {
      data = await this.shoppingHeadEntity.findOne({
        where: {
          soh_running: soh_running,
        },
        relations: {
          details: true,
          member: true,
        },
        select: {
          member: {
            mem_code: true,
          },
        },
      });

      if (!data) {
        throw new Error('No order data found');
      }

      return data as ShoppingHeadEntity;
    } catch {
      throw new BadRequestException('Something Error Please try again');
    }
  }

  async checkRepeatEmpCodeInTenMinute(emp_code: string): Promise<boolean> {
    try {
      const latestLog = await this.saleLogEntity.findOne({
        where: { emp_code },
        order: { log_date: 'DESC' },
      });

      if (!latestLog) {
        return false;
      }

      const diffMs = Date.now() - latestLog.log_date.getTime();
      const diffMinutes = diffMs / (1000 * 60);

      return diffMinutes < 10;
    } catch {
      throw new BadRequestException('Something Error Please try again');
    }
  }

  async submitOrder(
    data: {
      emp_code?: string;
      mem_code: string;
      mem_route?: string;
      listFree:
        | [
            {
              pro_code: string;
              amount: number;
              pro_unit1: string;
              pro_point: number;
              unit_enum: '1' | '2' | '3';
            },
          ]
        | null;
      priceOption: string;
      paymentOptions: string;
      shippingOptions: string;
      addressed: string | null;
    },
    ip?: string,
  ): Promise<string[] | undefined> {
    const isL16 = await this.isL16Member(data.mem_code, data.mem_route);
    const totalsummaryfromCart = await this.shoppingCartService.summaryCart(
      data.mem_code,
    );
    let orderContext: {
      memberCode: string;
      priceOption: string;
      totalPrice: number;
      item:
        | {
            pro_code: string;
            amount: number;
            unit: string;
            is_reward: boolean;
          }[]
        | null;
    } = {
      memberCode: data.mem_code,
      priceOption: data.priceOption,
      totalPrice: totalsummaryfromCart.total,
      item: null,
    };
    let basketSnapshot: {
      item_count: number;
      total_qty: number;
      items: Array<{
        spc_id: number;
        pro_code: string;
        amount: number;
        unit: string | null;
        is_reward: boolean;
        hotdeal_free: boolean;
      }>;
    } | null = null;
    let basketSnapshotError: string | null = null;
    let runningNumbers: string[] = [];
    const submitLogContext: Array<{ [mem_code: string]: any }> = [];
    try {
      const cartSnapshot = await this.shoppingCartService.handleGetCartToOrder(
        data.mem_code,
      );
      const items = (cartSnapshot ?? []).map((item) => ({
        spc_id: item.spc_id,
        pro_code: item.pro_code,
        amount: Number(item.spc_amount),
        unit:
          this.convertEnumToUnitName(item.spc_unit_enum, item.product?.units) ||
          null,
        is_reward: item.is_reward,
        hotdeal_free: item.hotdeal_free,
        promotion_id: item.promo_id,
        tier_id: item.tier_id,
      }));
      basketSnapshot = {
        item_count: items.length,
        total_qty: items.reduce((sum, item) => sum + Number(item.amount), 0),
        items,
      };
    } catch (error) {
      basketSnapshotError =
        error instanceof Error ? error.message : String(error);
    }
    this.logger.log('submit_order_attempt', {
      event: 'submit_order_attempt',
      status: 'attempt',
      mem_code: data.mem_code,
      priceOption: data.priceOption,
      paymentOptions: data.paymentOptions,
      shippingOptions: data.shippingOptions,
      total_price: totalsummaryfromCart.total,
      basket_snapshot: basketSnapshot,
      basket_snapshot_error: basketSnapshotError,
    });
    try {
      submitLogContext.push({
        mem_code: data.mem_code,
        body: JSON.stringify(data),
      });
      const numberOfMonth = new Date().getMonth() + 1;
      runningNumbers = [];
      const allIdCartForDelete: number[] = [];
      let totalSumPrice = 0;
      let totalSumPoint = 0;
      let pointAfterUse = 0;

      await this.dataSource.transaction(async (manager) => {
        submitLogContext.push({ transaction: 'start' });
        const cart: ShoppingCartEntity[] | undefined =
          await this.shoppingCartService.handleGetCartToOrder(data.mem_code);

        if (!cart || cart.length === 0) {
          orderContext = {
            memberCode: data.mem_code,
            priceOption: data.priceOption,
            totalPrice: totalsummaryfromCart.total,
            item: null,
          };
          throw new Error('Cart is empty');
        }

        if (isL16) {
          const restrictedItems = cart.filter(
            (item) => item.product?.pro_l16_only === 1,
          );
          if (restrictedItems.length > 0) {
            const codes = restrictedItems
              .map((item) => item.pro_code)
              .join(', ');
            throw new BadRequestException(
              `สินค้านี้ถูกซ่อนจากสมาชิก L16 และไม่สามารถสั่งซื้อได้: ${codes}`,
            );
          }
        }

        const checkFreebies =
          await this.shoppingCartService.getProFreebieHotdeal(data.mem_code);

        const groupCartArray = groupCart(cart, 80);

        for (const [groupIndex, group] of groupCartArray.entries()) {
          submitLogContext.push({ groupIndex, groupSize: group.length });
          allIdCartForDelete.push(...group.map((c) => c.spc_id));
          const head = this.shoppingHeadEntity.create({
            soh_sumprice: 0,
            member: { mem_code: data.mem_code },
            soh_payment_type: data.paymentOptions,
            soh_shipping_type: data.shippingOptions,
            editAddress: data.addressed ?? undefined,
          });

          const NewHead = await manager.save(ShoppingHeadEntity, head);
          const running = `005-${NewHead.soh_id.toString().padStart(6, '0')}`;
          await manager.update(
            ShoppingHeadEntity,
            { soh_id: NewHead.soh_id },
            { soh_running: running },
          );
          runningNumbers.push(running);
          submitLogContext.push({ createdOrderHead: running });

          const normalItems = group.filter((item) => !item.is_reward);
          const rewardItems = group.filter((item) => item.is_reward);

          const orderSales = normalItems.map((item) => {
            // ใช้ dynamic mapping แทน hardcode ratio
            const ratio = this.getRatioFromUnits(
              item.spc_unit_enum,
              item.product.units,
            );

            submitLogContext.push({
              unitLevel: item.spc_unit_enum,
              calculatedRatio: ratio,
              forProCode: item.pro_code,
            });

            const totalAmount = normalItems
              .filter((c) => c.pro_code === item.pro_code)
              .reduce((sum, sc) => {
                if (!sc.spc_unit_enum) {
                  throw new Error(
                    `Missing unit enum for product ${sc.pro_code} in cart item ${sc.spc_id}`,
                  );
                }
                const itemRatio = this.getRatioFromUnits(
                  sc.spc_unit_enum,
                  sc.product.units,
                );
                if (!itemRatio) {
                  throw new Error(
                    `Invalid unit enum ${sc.spc_unit_enum} for product ${sc.pro_code}`,
                  );
                }
                return sum + Number(sc.spc_amount) * itemRatio;
              }, 0);
            submitLogContext.push({ totalAmount, forProCode: item.pro_code });

            const isPromotionActive =
              item.product.pro_promotion_month === numberOfMonth &&
              totalAmount >= (item.product.pro_promotion_amount ?? 0);
            submitLogContext.push({
              isPromotionActive,
              forProCode: item.pro_code,
              pro_promotion_month: item.product.pro_promotion_month,
              currentMonth: numberOfMonth,
              totalAmount,
              pro_promotion_amount: item.product.pro_promotion_amount,
            });

            const isFlashSale = item.flashsale_end
              ? new Date(item.flashsale_end) >= new Date()
              : false;

            const unitPrice =
              data.priceOption === 'A'
                ? Number(item.product.pro_priceA)
                : data.priceOption === 'B'
                  ? Number(item.product.pro_priceB)
                  : data.priceOption === 'C'
                    ? Number(item.product.pro_priceC)
                    : 0;

            if (!item.spc_unit_enum) {
              throw new Error(
                `Missing unit enum for product ${item.pro_code} in cart item ${item.spc_id}`,
              );
            }

            let price =
              isPromotionActive || isFlashSale
                ? Number(item.spc_amount) *
                  Number(item.product.pro_priceA) *
                  ratio
                : Number(item.spc_amount) * unitPrice * ratio;

            const isFreebie = Boolean(
              item.hotdeal_free === true &&
              Array.isArray(checkFreebies) &&
              checkFreebies.some(
                (f) =>
                  f &&
                  String(f.spc_unit_enum) === String(item.spc_unit_enum) &&
                  String(f.pro_code) === String(item.pro_code),
              ),
            );

            if (isFreebie) {
              price = 0.0;
            }

            submitLogContext.push({
              calculatedPrice: price,
              isFreebie,
              forProCode: item.pro_code,
            });
            submitLogContext.push({ Success: true, forProCode: item.pro_code });

            // แปลง enum เป็น unit name สำหรับบันทึกลง database
            const unitName = this.convertEnumToUnitName(
              item.spc_unit_enum,
              item.product.units,
            );

            return manager.create(ShoppingOrderEntity, {
              orderHeader: { soh_running: running },
              spo_qty: item.spc_amount,
              spo_unit: unitName,
              spo_price_unit: price / item.spc_amount,
              spo_total_decimal: price,
              pro_code: item.pro_code,
              promotion_id: item.promo_id,
              tier_id: item.tier_id,
              is_reward: item.is_reward,
              spo_unit_enum: item.spc_unit_enum,
            });
          });

          const orderRewards: ShoppingOrderEntity[] = [];

          const limitItem = await this.promotionRewardEntity.find({
            where: {
              giftProduct: { pro_code: In(rewardItems.map((r) => r.pro_code)) },
            },
            select: {
              giftProduct: {
                pro_code: true,
                free_product_limit: true,
                free_product_count: true,
              },
            },
            relations: ['giftProduct'],
          });

          for (const item of rewardItems) {
            await manager.increment(
              ProductEntity,
              { pro_code: item.pro_code },
              'free_product_count',
              item.spc_amount,
            );

            const updated = await manager.findOne(PromotionRewardEntity, {
              where: { giftProduct: { pro_code: item.pro_code } },
              relations: ['giftProduct'],
            });

            const limitData = limitItem.find(
              (l) =>
                l.giftProduct.pro_code === item.pro_code &&
                l.giftProduct.free_product_limit !== null,
            );

            if (
              updated &&
              limitData &&
              updated.giftProduct.free_product_count >=
                limitData.giftProduct.free_product_limit
            ) {
              await axios.post(this.slackUrl, {
                text: `🚨 *แจ้งเตือนจำนวนของแถมถึงจุดที่กำหนดไว้แล้ว!*`,
                attachments: [
                  {
                    color: '#FF0000',
                    fields: [
                      {
                        title: 'สินค้า',
                        value: `${updated.giftProduct.pro_code}`,
                        short: true,
                      },
                      {
                        title: 'จำนวนแจกปัจจุบัน',
                        value: `${updated.giftProduct.free_product_count}/${limitData.giftProduct.free_product_limit}`,
                        short: true,
                      },
                    ],
                    footer: 'ระบบโปรโมชั่นอัตโนมัติ',
                    ts: Math.floor(Date.now() / 1000),
                  },
                  {
                    color: '#FFA500',
                    text: 'กรุณาตรวจสอบ *Stock ของแถม* เพื่อป้องกันการแจกเกินจำนวนที่กำหนดไว้',
                  },
                ],
              });
            }

            // แปลง enum เป็น unit name สำหรับบันทึกลง database
            const rewardUnitName = this.convertEnumToUnitName(
              item.spc_unit_enum,
              item.product?.units,
            );

            const orderItem = manager.create(ShoppingOrderEntity, {
              orderHeader: { soh_running: running },
              pro_code: item.pro_code,
              spo_unit: rewardUnitName,
              spo_qty: item.spc_amount,
              spo_price_unit: 0,
              spo_total_decimal: 0,
              is_reward: true,
              promotion_id: item.promo_id,
              tier_id: item.tier_id,
              spo_unit_enum: item.spc_unit_enum,
            });

            orderRewards.push(orderItem);
          }

          await manager.save(orderRewards);
          submitLogContext.push({
            orderSalesCount: orderSales.length,
            orderRewardsCount: orderRewards.length,
            forOrder: running,
          });

          const sumprice = orderSales.reduce(
            (total, order) => total + Number(order.spo_total_decimal),
            0,
          );
          totalSumPrice += sumprice;
          submitLogContext.push({
            sumprice,
            totalsummaryfromCart,
            forOrder: running,
          });

          if (groupIndex === groupCartArray.length - 1) {
            if (data.listFree && data.listFree.length > 0) {
              const listFree = await Promise.all(
                data.listFree.map((order) =>
                  manager.findOne(ProductEntity, {
                    where: { pro_code: order.pro_code },
                  }),
                ),
              );

              const sumpoint = listFree.reduce((total, order, index) => {
                if (!order?.pro_free) {
                  orderContext = {
                    memberCode: data.mem_code,
                    priceOption: data.priceOption,
                    totalPrice: totalsummaryfromCart.total,
                    item: cart.map((c) => ({
                      pro_code: c.pro_code,
                      amount: c.spc_amount,
                      unit: this.convertEnumToUnitName(
                        c.spc_unit_enum,
                        c.product.units,
                      ),
                      is_reward: c.is_reward,
                    })),
                  };
                  submitLogContext.push({
                    freebieError: 'No pro_free defined',
                    forProCode: data.listFree?.[index].pro_code,
                  });
                  throw new Error('Point Error');
                }
                const amount = data.listFree?.[index].amount ?? 0;
                const point = order?.pro_point ?? 0;
                submitLogContext.push({
                  calculatingPoint: point * amount,
                  forProCode: order.pro_code,
                });
                return total + point * amount;
              }, 0);

              pointAfterUse = totalsummaryfromCart.total * 0.01 - sumpoint;
              totalSumPoint += sumpoint;

              if (sumpoint && totalsummaryfromCart.total * 0.01 < sumpoint) {
                orderContext = {
                  memberCode: data.mem_code,
                  priceOption: data.priceOption,
                  totalPrice: totalsummaryfromCart.total,
                  item: cart.map((c) => ({
                    pro_code: c.pro_code,
                    amount: c.spc_amount,
                    unit: this.convertEnumToUnitName(
                      c.spc_unit_enum,
                      c.product.units,
                    ),
                    is_reward: c.is_reward,
                  })),
                };
                submitLogContext.push({
                  freebieError: 'Insufficient points for freebies',
                  totalsummaryfromCart: totalsummaryfromCart.total,
                  totalSumPoint,
                  forProCode: data.listFree?.map((f) => f.pro_code).join(', '),
                });
                throw new Error('Point Error');
              }

              const orderFree = data.listFree.map((order) =>
                manager.create(ShoppingOrderEntity, {
                  orderHeader: { soh_running: running },
                  pro_code: order.pro_code,
                  spo_unit: order.pro_unit1,
                  spo_qty: order.amount,
                  spo_unit_enum: order.unit_enum,
                }),
              );

              const saveFree = await manager.save(
                ShoppingOrderEntity,
                orderFree,
              );
              submitLogContext.push({
                savedFreebiesCount: saveFree.length,
                forOrder: running,
              });
              await manager.update(
                ShoppingHeadEntity,
                { soh_id: NewHead.soh_id },
                { soh_free: saveFree.length },
              );
            }
          }

          const saveProduct = await manager.save(ShoppingOrderEntity, [
            ...orderSales,
            ...orderRewards,
          ]);
          submitLogContext.push({
            savedProductsCount: saveProduct.length,
            forOrder: running,
          });

          const currentGroupTotal =
            totalsummaryfromCart.items[groupIndex]?.grandTotalItems || 0;

          // สร้าง order items สำหรับ Happy Hour scope filtering
          const happyHourItems = orderSales.map((os) => ({
            pro_code: os.pro_code!,
            amount: Number(os.spo_total_decimal),
            vendor_code: normalItems
              .find((n) => n.pro_code === os.pro_code)
              ?.product?.creditor?.creditor_code ?? undefined,
          }));

          submitLogContext.push({
            happyHourItemsForScope: happyHourItems.map((i) => ({
              pro_code: i.pro_code,
              amount: i.amount,
            })),
            currentGroupTotal,
          });

          // Happy Hour: คำนวณและบันทึก reward / excess discount
          let happyHourDiscount = 0;
          const happyReward =
            await this.happyHourService.calcHappyHourReward(currentGroupTotal, happyHourItems);

          if (happyReward) {
            submitLogContext.push({
              happyHour: {
                numCards: happyReward.numCards,
                excessDiscount: happyReward.excessDiscount,
                slotId: happyReward.slot.id,
              },
              forOrder: running,
            });

            const rewardCodes = happyReward.slot.rewards.map((r) => r.pro_code);
            if (happyReward.numCards > 0 && rewardCodes.length > 0) {
              const happyRewardItems = rewardCodes.map((proCode) => {
                const rewardEntry = happyReward.slot.rewards.find(
                  (r) => r.pro_code === proCode,
                );
                return manager.create(ShoppingOrderEntity, {
                  orderHeader: { soh_running: running },
                  pro_code: proCode,
                  spo_unit: rewardEntry?.unit ?? 'ใบ',
                  spo_unit_enum: '1', // happy hour reward ใช้ smallest unit เสมอ
                  spo_qty:
                    happyReward.numCards * (rewardEntry?.amount ?? happyReward.slot.reward_amount),
                  spo_price_unit: 0,
                  spo_total_decimal: 0,
                  is_happy_hour: true,
                });
              });
              await manager.save(ShoppingOrderEntity, happyRewardItems);
            }

            happyHourDiscount = happyReward.totalReward;
          }

          await manager.update(
            ShoppingHeadEntity,
            { soh_id: NewHead.soh_id },
            {
              soh_listsale: saveProduct.length,
              soh_sumprice: currentGroupTotal,
              soh_coin_after_use: pointAfterUse,
              soh_coin_recieve: currentGroupTotal * 0.01,
              soh_coin_use:
                pointAfterUse === 0
                  ? 0
                  : currentGroupTotal * 0.01 - pointAfterUse,
              emp_code: data.emp_code?.trim() ?? null,
              discount: happyHourDiscount || 0,
            },
          );
        }

        if (
          data.listFree &&
          data.listFree.length > 0 &&
          totalsummaryfromCart.total * 0.01 < totalSumPoint
        ) {
          orderContext = {
            memberCode: data.mem_code,
            priceOption: data.priceOption,
            totalPrice: totalsummaryfromCart.total,
            item: cart.map((c) => ({
              pro_code: c.pro_code,
              amount: c.spc_amount,
              unit: this.convertEnumToUnitName(
                c.spc_unit_enum,
                c.product?.units,
              ),
              is_reward: c.is_reward,
            })),
          };
          submitLogContext.push({ totalSumPoint, totalsummaryfromCart });
          throw new Error(`Point Error: totalSumPoint=${totalSumPoint}`);
        }

        if (
          totalSumPrice.toFixed(2) !== totalsummaryfromCart.total.toFixed(2)
        ) {
          orderContext = {
            memberCode: data.mem_code,
            priceOption: data.priceOption,
            totalPrice: totalsummaryfromCart.total,
            item: cart.map((c) => ({
              pro_code: c.pro_code,
              amount: c.spc_amount,
              unit: this.convertEnumToUnitName(
                c.spc_unit_enum,
                c.product?.units,
              ),
              is_reward: c.is_reward,
            })),
          };
          submitLogContext.push({
            totalSumPrice,
            expectedTotal: totalsummaryfromCart.total,
          });
          throw new Error('Total price mismatch');
        }
      });
      submitLogContext.push({
        transaction: 'end',
        allIdCartForDeleteCount: allIdCartForDelete.length,
      });
      for (const id of allIdCartForDelete) {
        await this.shoppingCartService.clearCheckoutCart(id);
      }
      this.logger.log('submit_order_trace', {
        event: 'submit_order_trace',
        mem_code: data.mem_code,
        submitLogContext,
      });
      this.logger.log('submit_order_result', {
        event: 'submit_order_result',
        status: 'success',
        mem_code: data.mem_code,
        running_numbers: runningNumbers,
        total_price: totalsummaryfromCart.total,
        basket_snapshot: basketSnapshot,
        basket_snapshot_error: basketSnapshotError,
      });
      if (data.emp_code) {
        const raw = this.saleLogEntity.create({
          sh_running: runningNumbers.join(', '),
          spo_total_decimal: totalsummaryfromCart.total,
          emp_code: data.emp_code?.trim(),
          ip_address: ip ?? '',
          mem_code: data.mem_code,
          log_date: new Date(),
        });
        await this.saleLogEntity.save(raw);
      }
      return runningNumbers;
    } catch (error) {
      this.logger.error('Error submitting order', {
        event: 'submit_order_result',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        member: orderContext?.memberCode || data.mem_code,
        totalPrice: totalsummaryfromCart.total,
        priceOption: orderContext?.priceOption || data.priceOption,
        orderContext,
        data,
        running_numbers: runningNumbers,
        basket_snapshot: basketSnapshot,
        basket_snapshot_error: basketSnapshotError,
      });
      this.logger.error('Error: ', error);
      const payload = {
        text: `❌ *Order Error* \n> Message: ${error instanceof Error ? error.message : String(error)}\n> Member: ${orderContext?.memberCode || data.mem_code}\n> Total Price: ${totalsummaryfromCart.total}\n> Price Option: ${orderContext?.priceOption || data.priceOption}`,
        attachments: [
          {
            color: '#ff0000',
            title: 'Order context',
            text: '```' + JSON.stringify(orderContext, null, 2) + '```',
          },
        ],
      };
      try {
        await axios.post(this.slackUrl, payload);
      } catch (e) {
        this.logger.error('Failed to notify Slack', e);
      }
      throw new Error('Failed to submit order. ' + error);
    }
  }

  async getLast6OrdersByMemberCode(memCode: string): Promise<any[]> {
    try {
      const isL16 = await this.isL16Member(memCode);
      const query = this.shoppingOrderRepo
        .createQueryBuilder('order')
        .leftJoin('order.product', 'product')
        .leftJoinAndSelect('product.units', 'units')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode AND cart.is_reward = false',
        )
        .setParameter('memCode', memCode)
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .leftJoin('order.orderHeader', 'header')
        .where('header.mem_code = :memCode', { memCode })
        .andWhere(
          '(product.pro_priceA != 0 OR product.pro_priceB != 0 OR product.pro_priceC != 0)',
        );

      if (isL16) {
        query.andWhere(
          '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
        );
      }

      const orders = await query
        .orderBy('header.soh_datetime', 'DESC')
        .take(20)
        .select([
          'order.spo_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.pro_promotion_month',
          'product.pro_promotion_amount',
          'product.viwers',
          'header.soh_datetime',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
          'units.id',
          'units.level',
          'units.unit_name',
          'units.ratio',
        ])
        .getMany();

      const uniqueMap = new Map<string, ShoppingOrderEntity>();
      for (const order of orders) {
        const code = order.product?.pro_code;
        if (code && !uniqueMap.has(code)) {
          uniqueMap.set(code, order);
        }
      }

      return Array.from(uniqueMap.values())
        .slice(0, 6)
        .map((order) => {
          const product = order.product;
          if (!product) return order;

          const units = (product.units ?? []) as unknown as {
            level: number;
            unit_name: string;
            ratio: number;
          }[];
          const unit1 = units.find((u) => u.level === 1);
          const unit2 = units.find((u) => u.level === 2);
          const unit3 = units.find((u) => u.level === 3);

          const resolvedCarts = (product.inCarts ?? []).map((cart) => {
            const found = units.find(
              (u) => u.level === Number(cart.spc_unit_enum),
            );
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { spc_unit_enum, ...cartWithoutEnum } =
              cart as typeof cart & {
                spc_unit_enum: string;
              };
            return { ...cartWithoutEnum, spc_unit: found?.unit_name ?? '' };
          });

          const productWithoutUnits = {
            ...(product as unknown as Record<string, unknown>),
          };
          delete productWithoutUnits['units'];

          return {
            ...order,
            product: {
              ...productWithoutUnits,
              pro_unit1: unit1?.unit_name ?? '',
              pro_unit2: unit2?.unit_name ?? '',
              pro_unit3: unit3?.unit_name ?? '',
              pro_ratio1: unit1?.ratio ?? 1,
              pro_ratio2: unit2?.ratio ?? 1,
              pro_ratio3: unit3?.ratio ?? 1,
              inCarts: resolvedCarts,
            },
          };
        }); //ส่งไปแค่ 6 อัน
    } catch (error) {
      this.logger.error(error);
      throw new Error('Failed to fetch order data.');
    }
  }

  async sendPurchaseEventToAnalytics(mem_code: string): Promise<void> {
    try {
      const cart =
        await this.shoppingCartService.handleGetCartToOrder(mem_code);
      if (!cart?.length) return;

      const taggedTierIds = Array.from(
        new Set(
          cart
            .filter(
              (item) =>
                !item.is_reward &&
                item.promo_id != null &&
                item.tier_id != null,
            )
            .map((item) => item.tier_id),
        ),
      );
      if (taggedTierIds.length === 0) return;

      const tiers = await this.promotionTierRepo.find({
        where: { tier_id: In(taggedTierIds) },
        relations: { promotion: true },
      });
      if (!tiers.length) return;

      tiers.sort((a, b) => {
        const minAmountDiff =
          Number(b.min_amount || 0) - Number(a.min_amount || 0);
        if (minAmountDiff !== 0) return minAmountDiff;
        const promoIdA = a.promotion?.promo_id ?? 0;
        const promoIdB = b.promotion?.promo_id ?? 0;
        if (promoIdA !== promoIdB) return promoIdA - promoIdB;
        return a.tier_id - b.tier_id;
      });

      const selectedTier = tiers[0];
      const promoId = selectedTier.promotion?.promo_id;
      if (!promoId) return;

      const promoName =
        selectedTier.promotion?.promo_name?.trim() ||
        `Company Day - ${selectedTier.tier_name}`;
      const tier = selectedTier.tier_name?.trim();
      if (!promoName || !tier) return;

      void this.companyDayAnalyticService.emitEvent('purchase', mem_code, {
        promo_id: promoId,
        promo_name: promoName,
        tier,
        source: 'Checkout',
      });
    } catch (error) {
      this.logger.warn(
        `Failed to emit company day purchase event: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async checkOrderTurnBackReward(sh_running: string, pro_code: string) {
    try {
      const dataOrder = await this.shoppingOrderRepo.findOne({
        where: {
          orderHeader: { soh_running: sh_running },
          pro_code,
          is_reward: false,
        },
        relations: {
          orderHeader: true,
        },
        select: {
          spo_id: true,
          pro_code: true,
          tier_id: true,
          promotion_id: true,
        },
      });

      if (!dataOrder) {
        return { status: true };
      }

      if (!dataOrder.promotion_id || !dataOrder.tier_id) {
        return { status: true };
      }

      const findPromotion =
        await this.promotionService.findPromotionTypeUnitBased(pro_code);

      if (findPromotion) {
        return { status: false, pro_code_in_promotion: findPromotion };
      }

      const minAmount = await this.promotionService.getTierPrice(
        dataOrder?.promotion_id,
        dataOrder?.tier_id,
      );

      const totalAmount = await this.shoppingOrderRepo.sum(
        'spo_total_decimal',
        {
          orderHeader: { soh_running: sh_running },
          is_reward: false,
          promotion_id: dataOrder.promotion_id,
          tier_id: dataOrder.tier_id,
          pro_code: Not(pro_code),
        },
      );

      const RewardProCodeInPromotion = await this.shoppingOrderRepo.find({
        where: {
          orderHeader: { soh_running: sh_running },
          promotion_id: dataOrder.promotion_id,
          tier_id: dataOrder.tier_id,
          is_reward: true,
        },
        select: { pro_code: true },
      });

      if (totalAmount === null) {
        return {
          status: false,
          pro_code_in_promotion: RewardProCodeInPromotion?.map(
            (item) => item.pro_code,
          ),
        };
      }

      if (
        totalAmount &&
        minAmount &&
        totalAmount < Number(minAmount.minAmount)
      ) {
        return {
          status: false,
          pro_code_in_promotion: RewardProCodeInPromotion?.map(
            (item) => item.pro_code,
          ),
        };
      }
      return { status: true };
    } catch (error) {
      this.logger.error(error);
      throw new Error('Failed to check order turn back reward. ' + error);
    }
  }

  async checkAndAdjustHappyHourReward(sh_running: string): Promise<{
    adjusted: boolean;
    removedQty: number;
    pro_code: string | null;
  }> {
    const happyHourItems = await this.shoppingOrderRepo.find({
      where: {
        orderHeader: { soh_running: sh_running },
        is_happy_hour: true,
      },
    });

    if (!happyHourItems.length) {
      return { adjusted: false, removedQty: 0, pro_code: null };
    }

    const rawTotal = await this.shoppingOrderRepo
      .createQueryBuilder('o')
      .innerJoin('o.orderHeader', 'h')
      .select('SUM(o.spo_total_decimal)', 'total')
      .where('h.soh_running = :sh_running', { sh_running })
      .andWhere('o.is_reward = false')
      .andWhere('o.is_happy_hour = false')
      .getRawOne<{ total: string }>();

    const total = Number(rawTotal?.total ?? 0);

    const happyProCode = happyHourItems[0].pro_code;
    const slots = await this.happyHourService.getSlots();
    const matchedSlot = slots.find((s) =>
      s?.rewards.some((r) => r.pro_code === happyProCode),
    );
    const rewardCodes = matchedSlot?.rewards.map((r) => r.pro_code) ?? [];

    if (!matchedSlot || !rewardCodes.length) {
      return { adjusted: false, removedQty: 0, pro_code: happyProCode };
    }

    const numCards = Math.floor(total / Number(matchedSlot.min_order_amount));
    // eligibleQty = qty ต่อ 1 reward product (ไม่ใช่ผลรวมทั้งหมด)
    const eligibleQty = numCards * matchedSlot.reward_amount;

    // เปรียบเทียบ qty ต่อ item (ทุก item ควรมี qty เท่ากันเมื่อสร้าง)
    const currentItemQty = Number(happyHourItems[0]?.spo_qty ?? 0);

    if (currentItemQty <= eligibleQty) {
      return { adjusted: false, removedQty: 0, pro_code: happyProCode };
    }

    // qty ที่ลดลง = ส่วนต่างต่อ item × จำนวน items ทั้งหมด
    const removedQty = (currentItemQty - eligibleQty) * happyHourItems.length;

    if (eligibleQty === 0) {
      // ไม่มีสิทธิ์รับ reward เลย — ลบทุก item
      await this.shoppingOrderRepo.delete(happyHourItems.map((i) => i.spo_id));
    } else {
      // อัปเดต qty ทุก reward item แยกกัน — แต่ละ product มี eligibleQty ของตัวเอง
      await Promise.all(
        happyHourItems.map((item) =>
          this.shoppingOrderRepo.update(item.spo_id, { spo_qty: eligibleQty }),
        ),
      );
    }

    this.logger.log('happy_hour_reward_adjusted', {
      sh_running,
      pro_code: happyProCode,
      previousQty: currentItemQty,
      newQty: eligibleQty,
      removedQty,
      orderTotal: total,
      minOrder: matchedSlot.min_order_amount,
    });

    return { adjusted: true, removedQty, pro_code: happyProCode };
  }
}

function groupCart(
  cart: ShoppingCartEntity[],
  limit: number,
): ShoppingCartEntity[][] {
  const groups: ShoppingCartEntity[][] = [];
  let currentGroup: ShoppingCartEntity[] = [];
  let currentCodes = new Set<string>();

  // console.log('cart to group:', cart);
  // console.log('Grouping cart with limit:', limit);
  for (const item of cart) {
    if (currentCodes.has(item.pro_code)) {
      currentGroup.push(item);
      continue;
    }
    if (currentCodes.size < limit) {
      currentGroup.push(item);
      currentCodes.add(item.pro_code);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      currentCodes = new Set([item.pro_code]);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }
  // console.log('Grouped cart result:', groups);

  return groups;
}
