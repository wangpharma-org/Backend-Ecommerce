import { Injectable } from '@nestjs/common';
import { NewArrival } from './new-arrival.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class NewArrivalsService {
  constructor(
    @InjectRepository(NewArrival)
    private readonly newArrivalsRepository: Repository<NewArrival>,
  ) {}

  async addNewArrival(
    pro_code: string,
    LOT: string,
    MFG: string,
    EXP: string,
    createdAt: Date,
  ): Promise<{
    product: { pro_code: string };
    LOT: string;
    MFG: string;
    EXP: string;
    createdAt: Date;
  }> {
    try {
      console.log('Adding new arrival:', {
        pro_code,
        LOT,
        MFG,
        EXP,
        createdAt,
      });
      const newArrival = this.newArrivalsRepository.create({
        product: { pro_code: pro_code },
        LOT,
        MFG,
        EXP,
        createdAt,
      });
      return this.newArrivalsRepository.save(newArrival);
    } catch (error) {
      console.error('Error adding new arrival:', error);
      throw new Error('Error adding new arrival');
    }
  }

  async getNewArrivalsLimit30(memCode: string): Promise<any[]> {
    const results = await this.newArrivalsRepository
      .createQueryBuilder('newArrival')
      .leftJoinAndSelect('newArrival.product', 'product')
      .leftJoinAndSelect('product.inCarts', 'cart', 'cart.mem_code = :memCode', { memCode })
      .groupBy('product.pro_code')
      .addGroupBy('newArrival.id')
      .addGroupBy('cart.spc_id')
      .addGroupBy('cart.spc_amount')
      .addGroupBy('cart.spc_unit')
      .addGroupBy('cart.mem_code')
      .orderBy('newArrival.createdAt', 'DESC')
      .take(30)
      .select([
          'newArrival.id',
          'newArrival.createdAt',
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
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
        ])
      .getMany();
    
    // Return เฉพาะข้อมูล product
    return results.map((item) => item.product);
  }
}
