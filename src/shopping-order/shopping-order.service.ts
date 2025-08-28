import { Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { HttpService } from '@nestjs/axios';
import { FailedEntity } from '../failed-api/failed-api.entity';
import { ProductEntity } from '../products/products.entity';
import { DataSource } from 'typeorm';

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

      // const response = await lastValueFrom(
      //   this.httpService.post(
      //     'https://www.wangpharma.com/Akitokung/api/order/receive_order_cart.php',
      //     data,
      //   ),
      // );

      // if (response.status === 200) {
      //   return;
      // }

      console.log('data on sendDataToOldSystem', data);
    } catch {
      // const res2 = await lastValueFrom(
      //   this.httpService.post(this.slackUrl, {
      //     text: `\n*ด่วน! ออเดอร์อาจตกหล่น*\n\n*ปัญหาเกิดจาก* : ระบบพี่โต้ล่ม\n*ข้อมูล* \n${data}`,
      //   }),
      // );
      // console.log('Notify external API :', res2);
      await this.failedEntity.save(
        this.failedEntity.create({
          failed_json: JSON.parse(JSON.stringify(data)) as JSON,
        }),
      );
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
  }): Promise<string | undefined> {
    try {
      const numberOfMonth = new Date().getMonth() + 1;
      let pointAfterUse = 0;

      const running = await this.dataSource.transaction(async (manager) => {
        const cart = await this.shoppingCartService.handleGetCartToOrder(
          data.mem_code,
        );

        if (!cart || cart.length === 0) {
          throw new Error('Cart is empty');
        }

        const head = this.shoppingHeadEntity.create({
          soh_sumprice: data.total_price,
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

        const orderSales = cart.map((item) => {
          const unitRatioMap = new Map([
            [item.product.pro_unit1, item.product.pro_ratio1],
            [item.product.pro_unit2, item.product.pro_ratio2],
            [item.product.pro_unit3, item.product.pro_ratio3],
          ]);

          const totalAmount = cart
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
            ? Number(item.spc_amount) * Number(item.product.pro_priceA) * ratio
            : Number(item.spc_amount) * unitPrice * ratio;

          const order = manager.create(ShoppingOrderEntity, {
            orderHeader: { soh_running: running },
            spo_qty: item.spc_amount,
            spo_unit: item.spc_unit,
            spo_price_unit: price / item.spc_amount,
            spo_total_decimal: price,
            pro_code: item.pro_code,
          });

          return order;
        });

        const sumprice = orderSales.reduce(
          (total, order) => total + Number(order.spo_total_decimal),
          0,
        );

        if (sumprice !== data.total_price) {
          throw new Error('Price Error');
        }

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
              throw new Error('Point Error');
            }
            const amount = data.listFree?.[index].amount ?? 0;
            const point = order?.pro_point ?? 0;
            return total + point * amount;
          }, 0);

          pointAfterUse = sumprice * 0.01 - sumpoint;

          if (sumpoint && sumprice * 0.01 < sumpoint) {
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

        const saveProduct = await manager.save(ShoppingOrderEntity, orderSales);
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

        cart.map(
          (c) => void this.shoppingCartService.clearCheckoutCart(c.spc_id),
        );

        return running;
      });

      if (running) {
        await this.sendDataToOldSystem(running);
        return running;
      }
    } catch (error) {
      console.log('Error: ', error);
    }
  }

  async getLast6OrdersByMemberCode(
    memCode: string,
  ): Promise<ShoppingOrderEntity[]> {
    try {
      const orders = await this.shoppingOrderRepo //ดึงข้อมูลมา 20 ข้อมูลล่าสุด
        .createQueryBuilder('order')
        .leftJoin('order.product', 'product')
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
          'header.soh_datetime',
        ])
        .getMany();

      const uniqueMap = new Map<string, ShoppingOrderEntity>(); //กรอกอันที่ซ้ำออก
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
