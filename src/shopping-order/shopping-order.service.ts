import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { HttpService } from '@nestjs/axios';
import { FailedEntity } from '../failed-api/failed-api.entity';
import { ProductEntity } from '../products/products.entity';
import { DataSource } from 'typeorm';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import axios from 'axios';
import { submitOrder } from 'src/logger/submitOrder.logger';
import { Cron } from '@nestjs/schedule';
import { SaleLogEntity } from './salelog-order.entity';

interface CountSale {
  pro_code: string;
  order_count: number;
}

@Injectable()
export class ShoppingOrderService {
  private readonly slackUrl = process.env.SLACK_WEBHOOK_URL || '';
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
  ) {}

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
      total_price: number;
      listFree:
        | [
            {
              pro_code: string;
              amount: number;
              pro_unit1: string;
              pro_point: number;
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
      totalPrice: data.total_price,
      item: null,
    };
    const submitLogContext: Array<{ [mem_code: string]: any }> = [];
    try {
      submitLogContext.push({
        mem_code: data.mem_code,
        body: JSON.stringify(data),
      });
      const numberOfMonth = new Date().getMonth() + 1;
      const runningNumbers: string[] = [];
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
            totalPrice: data.total_price,
            item: null,
          };
          throw new Error('Cart is empty');
        }

        const checkFreebies =
          await this.shoppingCartService.getProFreebieHotdeal(data.mem_code);

        const groupCartArray = groupCart(cart, 80);

        console.log('Grouped cart items:', groupCartArray);

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
            const unitRatioMap = new Map([
              [item.product.pro_unit1, item.product.pro_ratio1],
              [item.product.pro_unit2, item.product.pro_ratio2],
              [item.product.pro_unit3, item.product.pro_ratio3],
            ]);
            submitLogContext.push({
              unitRatioMap: Array.from(unitRatioMap.entries()),
            });

            const totalAmount = normalItems
              .filter((c) => c.pro_code === item.pro_code)
              .reduce((sum, sc) => {
                const ratio = unitRatioMap.get(sc.spc_unit) ?? 0;
                return sum + Number(sc.spc_amount) * ratio;
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

            const ratio = unitRatioMap.get(item.spc_unit) ?? 1;
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
                    String(f.spc_unit) === String(item.spc_unit) &&
                    String(f.pro_code) === String(item.pro_code),
                ),
            );

            console.log('Freebie check:', { isFreebie, item, checkFreebies });
            if (isFreebie) {
              price = 0.0;
            }

            submitLogContext.push({
              calculatedPrice: price,
              isFreebie,
              forProCode: item.pro_code,
            });
            submitLogContext.push({ Success: true, forProCode: item.pro_code });
            return manager.create(ShoppingOrderEntity, {
              orderHeader: { soh_running: running },
              spo_qty: item.spc_amount,
              spo_unit: item.spc_unit,
              spo_price_unit: price / item.spc_amount,
              spo_total_decimal: price,
              pro_code: item.pro_code,
            });
          });

          const orderRewards = rewardItems.map((item) =>
            manager.create(ShoppingOrderEntity, {
              orderHeader: { soh_running: running },
              pro_code: item.pro_code,
              spo_unit: item.spc_unit,
              spo_qty: item.spc_amount,
              spo_price_unit: 0,
              spo_total_decimal: 0,
            }),
          );
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
          submitLogContext.push({ sumprice, totalSumPrice, forOrder: running });

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
                    totalPrice: data.total_price,
                    item: cart.map((c) => ({
                      pro_code: c.pro_code,
                      amount: c.spc_amount,
                      unit: c.spc_unit,
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

              pointAfterUse = totalSumPrice * 0.01 - sumpoint;
              totalSumPoint += sumpoint;

              if (sumpoint && totalSumPrice * 0.01 < sumpoint) {
                orderContext = {
                  memberCode: data.mem_code,
                  priceOption: data.priceOption,
                  totalPrice: data.total_price,
                  item: cart.map((c) => ({
                    pro_code: c.pro_code,
                    amount: c.spc_amount,
                    unit: c.spc_unit,
                    is_reward: c.is_reward,
                  })),
                };
                submitLogContext.push({
                  freebieError: 'Insufficient points for freebies',
                  totalSumPrice,
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
          await manager.update(
            ShoppingHeadEntity,
            { soh_id: NewHead.soh_id },
            {
              soh_listsale: saveProduct.length,
              soh_sumprice: sumprice,
              soh_coin_after_use: pointAfterUse,
              soh_coin_recieve: sumprice * 0.01,
              soh_coin_use: sumprice * 0.01 - pointAfterUse,
              emp_code: data.emp_code?.trim() ?? null,
            },
          );
        }

        if (totalSumPrice.toFixed(2) !== data.total_price.toFixed(2)) {
          orderContext = {
            memberCode: data.mem_code,
            priceOption: data.priceOption,
            totalPrice: data.total_price,
            item: cart.map((c) => ({
              pro_code: c.pro_code,
              amount: c.spc_amount,
              unit: c.spc_unit,
              is_reward: c.is_reward,
            })),
          };
          submitLogContext.push({
            totalSumPrice,
            expectedTotalPrice: data.total_price,
          });
          throw new Error(
            `Price Error: totalSumPrice=${totalSumPrice}, data.total_price=${data.total_price}`,
          );
        }

        if (
          data.listFree &&
          data.listFree.length > 0 &&
          totalSumPrice * 0.01 < totalSumPoint
        ) {
          orderContext = {
            memberCode: data.mem_code,
            priceOption: data.priceOption,
            totalPrice: data.total_price,
            item: cart.map((c) => ({
              pro_code: c.pro_code,
              amount: c.spc_amount,
              unit: c.spc_unit,
              is_reward: c.is_reward,
            })),
          };
          submitLogContext.push({ totalSumPoint, totalSumPrice });
          throw new Error(`Point Error: totalSumPoint=${totalSumPoint}`);
        }
      });
      submitLogContext.push({
        transaction: 'end',
        allIdCartForDeleteCount: allIdCartForDelete.length,
      });
      for (const id of allIdCartForDelete) {
        await this.shoppingCartService.clearCheckoutCart(id);
      }
      submitOrder.info('data ', { submitLogContext });
      if (data.emp_code) {
        const raw = this.saleLogEntity.create({
          sh_running: runningNumbers.join(', '),
          spo_total_decimal: data.total_price,
          emp_code: data.emp_code?.trim(),
          ip_address: ip ?? '',
          mem_code: data.mem_code,
          log_date: new Date(),
        });
        await this.saleLogEntity.save(raw);
      }
      return runningNumbers;
    } catch (error) {
      submitOrder.error('Error submitting order', {
        error: error instanceof Error ? error.message : String(error),
        member: orderContext?.memberCode || data.mem_code,
        totalPrice: orderContext?.totalPrice || data.total_price,
        priceOption: orderContext?.priceOption || data.priceOption,
        orderContext,
        data,
      });
      console.error('Error: ', error);
      const payload = {
        text: `❌ *Order Error* \n> Message: ${error instanceof Error ? error.message : String(error)}\n> Member: ${orderContext?.memberCode || data.mem_code}\n> Total Price: ${orderContext?.totalPrice || data.total_price}\n> Price Option: ${orderContext?.priceOption || data.priceOption}`,
        attachments: [
          {
            color: '#ff0000',
            title: 'Order context',
            text: '```' + JSON.stringify(orderContext, null, 2) + '```',
          },
        ],
      };
      try {
        console.log('Slack Url: ', this.slackUrl);
        await axios.post(this.slackUrl, payload);
      } catch (e) {
        console.error('Failed to notify Slack', e);
      }
      throw new Error('Failed to submit order. ' + error);
    }
  }

  async getLast6OrdersByMemberCode(
    memCode: string,
  ): Promise<ShoppingOrderEntity[]> {
    try {
      const orders = await this.shoppingOrderRepo
        .createQueryBuilder('order')
        .leftJoin('order.product', 'product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode',
          { memCode },
        )
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .leftJoin('order.orderHeader', 'header')
        .where('header.mem_code = :memCode', { memCode })
        .andWhere(
          '(product.pro_priceA != 0 OR product.pro_priceB != 0 OR product.pro_priceC != 0)',
        )
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
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.pro_promotion_month',
          'product.pro_promotion_amount',
          'header.soh_datetime',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
        ])
        .getMany();

      const uniqueMap = new Map<string, ShoppingOrderEntity>();
      for (const order of orders) {
        const code = order.product?.pro_code;
        if (code && !uniqueMap.has(code)) {
          uniqueMap.set(code, order);
        }
      }
      return Array.from(uniqueMap.values()).slice(0, 6); //ส่งไปแค่ 6 อัน
    } catch (error) {
      console.log(error);
      throw new Error('Failed to fetch order data.');
    }
  }
}

function groupCart(
  cart: ShoppingCartEntity[],
  limit: number,
): ShoppingCartEntity[][] {
  const groups: ShoppingCartEntity[][] = [];
  let currentGroup: ShoppingCartEntity[] = [];
  let currentCodes = new Set<string>();

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

  return groups;
}
