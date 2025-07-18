import { Injectable } from '@nestjs/common';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
@Injectable()
export class ShoppingCartService {
  constructor(
    @InjectRepository(ShoppingCartEntity)
    private readonly shoppingCartRepo: Repository<ShoppingCartEntity>,
  ) {}

  async addProductCart(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
  }) {
    try {
      const updateData = {
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        spc_unit: data.pro_unit,
        spc_amount: data.amount,
        spc_datetime: Date(),
      };
      return await this.shoppingCartRepo.save(updateData);
    } catch (error) {
      console.error('Error saving product cart:', error);
      throw new Error(`Error in Add product Cart`);
    }
  }

  async getProductCart(mem_code: string): Promise<ShoppingCartEntity[]> {
    try {
      const data = await this.shoppingCartRepo.find({
        where: {
          mem_code: mem_code,
        },
        relations: ['product'],
        select: {
          spc_amount: true,
          spc_checked: true,
          spc_id: true,
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_priceA: true,
            pro_priceB: true,
            pro_priceC: true,
            pro_unit1: true,
            pro_unit2: true,
            pro_unit3: true,
            pro_ratio1: true,
            pro_ratio2: true,
            pro_ratio3: true,
          },
        },
      });
      return data;
    } catch (error) {
      console.error('Error get product cart:', error);
      throw new Error(`Error in Get product Cart`);
    }
  }
}
