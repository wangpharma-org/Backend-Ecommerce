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
    listFree: { pro_code: string; amount: number };
    priceOption: string;
  }) {
    const cart = await this.shoppingCartService.handleGetCartToOrder(
      data.mem_code,
    );
    const order = cart?.map((item) => {
      const unitPrice =
        data.priceOption === 'A'
          ? item.product.pro_priceA
          : data.priceOption === 'B'
            ? item.product.pro_priceB
            : data.priceOption === 'C'
              ? item.product.pro_priceC
              : 0;

      const ratio =
        item.product.pro_unit1 === item.spc_unit
          ? item.product.pro_ratio1
          : item.product.pro_unit2 === item.spc_unit
            ? item.product.pro_ratio2
            : item.product.pro_unit3 === item.spc_unit
              ? item.product.pro_ratio3
              : 1;

      const price = item.spc_amount * unitPrice * ratio;
      return {
        spo_qty: item.spc_amount,
        spo_unit: item.spc_unit,
        spo_unit_price: unitPrice,
        spo_total_decimal: price,
        pro_code: item.pro_code,
      };
    });

    if (order) {
      await this.shoppingOrderRepo.save(order);
    }

    // await this.shoppingHeadEntity.create({
      
    // })
  }
}
