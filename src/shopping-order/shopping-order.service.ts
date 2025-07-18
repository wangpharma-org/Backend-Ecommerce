import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';

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
  ) {}

  // ✅ ดึงข้อมูล 6 รายการล่าสุดของแต่ละ mem_code
  async getLast6OrdersByMemberCode(memCode: string): Promise<ShoppingOrderEntity[]> {
    return this.shoppingOrderRepo
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.product', 'product')
      .leftJoinAndSelect('order.orderHeader', 'header')
      .leftJoinAndSelect('header.member', 'member')
      .where('member.mem_code = :memCode', { memCode })
      .orderBy('header.soh_datetime', 'DESC')
      .limit(6)
      .getMany();
  }

  
}