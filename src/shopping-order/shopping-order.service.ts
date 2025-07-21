import { Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';
@Injectable()
export class ShoppingOrderService {
  constructor(
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadEntity: Repository<ShoppingHeadEntity>,
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepo: Repository<ShoppingOrderEntity>,
    private readonly shoppingCartService: ShoppingCartService,
  ) {}

  async submitOrder(data: {
    mem_code: string;
    total_price: number;
    listFree: [{ pro_code: string; amount: number; pro_unit1: string }] | null;
    priceOption: string;
    paymentOptions: string;
    shippingOptions: string;
  }): Promise<string | undefined> {
    try {
      const cart = await this.shoppingCartService.handleGetCartToOrder(
        data.mem_code,
      );

      const head = this.shoppingHeadEntity.create({
        soh_sumprice: data.total_price,
        member: { mem_code: data.mem_code },
        soh_saledate: new Date(),
        soh_payment_type: data.paymentOptions,
        soh_shipping_type: data.shippingOptions,
      });

      const NewHead = await this.shoppingHeadEntity.save(head);
      const running = `005-${NewHead.soh_id.toString().padStart(6, '0')}`;
      await this.shoppingHeadEntity.update(
        { soh_id: NewHead.soh_id },
        { soh_running: running },
      );

      const orderSales = cart?.map((item) => {
        const unitPrice =
          data.priceOption === 'A'
            ? item?.product?.pro_priceA
            : data.priceOption === 'B'
              ? item?.product?.pro_priceB
              : data.priceOption === 'C'
                ? item?.product?.pro_priceC
                : 0;

        const ratio =
          item?.product?.pro_unit1 === item?.spc_unit
            ? item?.product?.pro_ratio1
            : item?.product?.pro_unit2 === item?.spc_unit
              ? item?.product?.pro_ratio2
              : item?.product?.pro_unit3 === item?.spc_unit
                ? item?.product?.pro_ratio3
                : 1;

        if (isNaN(unitPrice) || isNaN(ratio) || isNaN(item.spc_amount)) {
          console.log('Bad item:', item);
          throw new Error('Invalid product price or ratio');
        }

        const price = item.spc_amount * unitPrice * ratio;

        const order = this.shoppingOrderRepo.create({
          orderHeader: { soh_running: running },
          spo_qty: item.spc_amount,
          spo_unit: item.spc_unit,
          spo_price_unit: unitPrice,
          spo_total_decimal: price,
          pro_code: item.pro_code,
        });
        return order;
      });

      const sumprice = orderSales?.reduce((total, order) => {
        return total + Number(order.spo_total_decimal);
      }, 0);

      if (sumprice !== data.total_price) {
        console.log('Sumprice: ', sumprice);
        console.log('data.total_price: ', data.total_price);
        throw new Error('Price Error');
      }

      if (data.listFree && data.listFree.length > 0) {
        const orderFree = data.listFree.map((order) => {
          const orderFreeMap = this.shoppingOrderRepo.create({
            orderHeader: { soh_running: running },
            pro_code: order.pro_code,
            spo_unit: order.pro_unit1,
            spo_qty: order.amount,
          });
          return orderFreeMap;
        });

        const saveProduct = await this.shoppingOrderRepo.save(orderFree);
        await this.shoppingHeadEntity.update(
          { soh_id: NewHead.soh_id },
          { soh_free: saveProduct.length },
        );
      }

      if (orderSales) {
        console.log(orderSales);
        const saveProduct = await this.shoppingOrderRepo.save(orderSales);
        await this.shoppingHeadEntity.update(
          { soh_id: NewHead.soh_id },
          {
            soh_listsale: saveProduct.length,
            soh_sumprice: sumprice,
          },
        );
        cart?.map((cart) => {
          void this.shoppingCartService.clearCheckoutCart(cart.spc_id);
        });

        return running;
      } else {
        return;
      }
    } catch (error) {
      console.log('Error : ', error);
      throw new Error('Something Wrong in Submit');
    }
  }
}
