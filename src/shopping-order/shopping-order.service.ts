import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { ShoppingHeadService } from 'src/shopping-head/shopping-head.service';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';
import { json } from 'stream/consumers';
import { stringify } from 'querystring';

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
        @InjectRepository(ShoppingOrderEntity)
        private readonly shoppingOrderRepo: Repository<ShoppingOrderEntity>,
    ) { }

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