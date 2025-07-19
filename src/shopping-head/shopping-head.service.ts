import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { ShoppingHeadEntity } from './shopping-head.entity';
import { Repository } from 'typeorm';

export interface ShoppingHead {
    soh_runing: string;
    soh_sumprice: number;
    soh_datetime: string; // หรือ Date ถ้าเป็น object
    soh_coin_recieve: number;
    details: ShoppingOrder[];
}

export interface ShoppingOrder {
    pro_code: string;
    pro_imgmain: string | null;
}


@Injectable()
export class ShoppingHeadService {
    constructor(
        @InjectRepository(ShoppingHeadEntity)
        private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>
    ) { }
    async AllOrderByMember(mem_code: string): Promise<ShoppingHeadEntity[]> {
        try {
            const result = await this.shoppingHeadRepo
                .createQueryBuilder('head')
                .leftJoin('head.details', 'order')
                .leftJoin('order.product', 'product')
                .where('head.mem_code = mem_code', { mem_code })
                .select([
                    'head.soh_runing',
                    'head.soh_sumprice',
                    'head.soh_datetime',
                    'head.soh_coin_recieve',
                    // 'order', // ดึงทั้งหมดของ order
                    'order.spo_id',
                    'product.pro_code',
                    'product.pro_imgmain',
                ])
                .orderBy('head.soh_datetime', 'DESC')
                .getMany();
            return result;
        }
        catch (error) {
            console.error('Error get Order fail:', error);
            throw new Error(`Error get Order fail`);
        }
    }

}
