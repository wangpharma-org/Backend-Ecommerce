import { BadRequestException, Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { HttpService } from '@nestjs/axios';
import { FailedEntity } from '../failed-api/failed-api.entity';
import { ProductEntity } from '../products/products.entity';
import { DataSource } from 'typeorm';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';

@Injectable()
export class ShoppingOrderService {
  private slackUrl =
    'https://hooks.slack.com/services/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';
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
  ) {}

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

  async submitOrder(data: {
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
  }): Promise<string[] | undefined> {
    try {
      const numberOfMonth = new Date().getMonth() + 1;
      const runningNumbers: string[] = [];
      let totalSumPrice = 0;
      let totalSumPoint = 0;
      let pointAfterUse = 0;
      await this.dataSource.transaction(async (manager) => {
        const cart: ShoppingCartEntity[] | undefined =
          await this.shoppingCartService.handleGetCartToOrder(data.mem_code);

        if (!cart || cart.length === 0) {
          throw new Error('Cart is empty');
        }

        const groupCartArray = groupCart(cart, 80);

        for (const [groupIndex, group] of groupCartArray.entries()) {
          const head = this.shoppingHeadEntity.create({
            soh_sumprice: 0,
            member: { mem_code: data.mem_code },
            soh_payment_type: data.paymentOptions,
            soh_shipping_type: data.shippingOptions,
          });

          const NewHead = await manager.save(ShoppingHeadEntity, head);
          const running = `005-${NewHead.soh_id.toString().padStart(6, '0')}`;
          await manager.update(
            ShoppingHeadEntity,
            { soh_id: NewHead.soh_id },
            { soh_running: running },
          );
          runningNumbers.push(running);

          const orderSales = group.map((item) => {
            const unitRatioMap = new Map([
              [item.product.pro_unit1, item.product.pro_ratio1],
              [item.product.pro_unit2, item.product.pro_ratio2],
              [item.product.pro_unit3, item.product.pro_ratio3],
            ]);

            const totalAmount = group
              .filter((c) => c.pro_code === item.pro_code)
              .reduce((sum, sc) => {
                const ratio = unitRatioMap.get(sc.spc_unit) ?? 0;
                return sum + Number(sc.spc_amount) * ratio;
              }, 0);

            const isPromotionActive =
              item.product.pro_promotion_month === numberOfMonth &&
              totalAmount >= (item.product.pro_promotion_amount ?? 0);

            const unitPrice =
              data.priceOption === 'A'
                ? Number(item.product.pro_priceA)
                : data.priceOption === 'B'
                  ? Number(item.product.pro_priceB)
                  : data.priceOption === 'C'
                    ? Number(item.product.pro_priceC)
                    : 0;

            const ratio = unitRatioMap.get(item.spc_unit) ?? 1;
            const price = isPromotionActive
              ? Number(item.spc_amount) *
                Number(item.product.pro_priceA) *
                ratio
              : Number(item.spc_amount) * unitPrice * ratio;

            return manager.create(ShoppingOrderEntity, {
              orderHeader: { soh_running: running },
              spo_qty: item.spc_amount,
              spo_unit: item.spc_unit,
              spo_price_unit: price / item.spc_amount,
              spo_total_decimal: price,
              pro_code: item.pro_code,
            });
          });

          const sumprice = orderSales.reduce(
            (total, order) => total + Number(order.spo_total_decimal),
            0,
          );
          totalSumPrice += sumprice;

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
                if (!order?.pro_free) throw new Error('Point Error');
                const amount = data.listFree?.[index].amount ?? 0;
                const point = order?.pro_point ?? 0;
                return total + point * amount;
              }, 0);

              pointAfterUse = totalSumPrice * 0.01 - sumpoint;
              totalSumPoint += sumpoint;

              if (sumpoint && totalSumPrice * 0.01 < sumpoint) {
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

              const saveProduct = await manager.save(
                ShoppingOrderEntity,
                orderFree,
              );

              await manager.update(
                ShoppingHeadEntity,
                { soh_id: NewHead.soh_id },
                { soh_free: saveProduct.length },
              );
            }
          }

          const saveProduct = await manager.save(
            ShoppingOrderEntity,
            orderSales,
          );
          await manager.update(
            ShoppingHeadEntity,
            { soh_id: NewHead.soh_id },
            {
              soh_listsale: saveProduct.length,
              soh_sumprice: sumprice,
              soh_coin_after_use: pointAfterUse,
              soh_coin_recieve: sumprice * 0.01,
              soh_coin_use: sumprice * 0.01 - pointAfterUse,
            },
          );

          for (const c of group) {
            await this.shoppingCartService.clearCheckoutCart(c.spc_id);
          }
        }

        if (totalSumPrice.toFixed(2) !== data.total_price.toFixed(2)) {
          throw new Error(
            `Price Error: totalSumPrice=${totalSumPrice}, data.total_price=${data.total_price}`,
          );
        }

        if (
          data.listFree &&
          data.listFree.length > 0 &&
          totalSumPrice * 0.01 < totalSumPoint
        ) {
          throw new Error(`Point Error: totalSumPoint=${totalSumPoint}`);
        }
      });

      return runningNumbers;
    } catch (error) {
      console.log('Error: ', error);
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
        .leftJoin('order.orderHeader', 'header')
        .where('header.mem_code = :memCode', { memCode })
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
          'header.soh_datetime',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
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
