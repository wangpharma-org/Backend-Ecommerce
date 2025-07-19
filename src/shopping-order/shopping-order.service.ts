import { Injectable } from '@nestjs/common';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';

interface ProductDto {
    proname: string;
    propriceA: number;
    propriceB: number;
    propriceC: number;
    pro_imgmain: string;
}

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
  // ✅ ดึงข้อมูล 6 รายการล่าสุดของแต่ละ mem_code
    async getLast6OrdersByMemberCode(memCode: string): Promise<ShoppingOrderEntity[]> {
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
                    'header.soh_datetime'
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
        }
        catch (error) {
            console.log(error)
            throw new Error('Failed to fetch order data.')
        }

    }

}

