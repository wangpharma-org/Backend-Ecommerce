import { Injectable } from '@nestjs/common';
import { NewArrival } from './new-arrival.entity';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';

@Injectable()
export class NewArrivalsService {
  constructor(
    @InjectRepository(NewArrival)
    private readonly newArrivalsRepository: Repository<NewArrival>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

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

      const existingRecords = await this.newArrivalsRepository.find({
        where: { createdAt },
      });

      if (existingRecords.length > 0) {
        console.log(
          `Found ${existingRecords.length} existing records with same createdAt, deleting...`,
        );
        await this.newArrivalsRepository.remove(existingRecords);
        console.log('Existing records deleted successfully');
      }

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

  async getNewArrivalsLimit30(
    memCode: string,
    mem_route?: string,
  ): Promise<any[]> {
    const isL16 = await this.isL16Member(memCode, mem_route);
    const results = await this.newArrivalsRepository
      .createQueryBuilder('newArrival')
      .leftJoinAndSelect('newArrival.product', 'product')
      .leftJoinAndSelect(
        'product.inCarts',
        'cart',
        'cart.mem_code = :memCode AND cart.is_reward = false',
      )
      .setParameter('memCode', memCode)
      .where(
        'product.pro_priceA != 1 AND product.pro_priceB != 1 AND product.pro_priceC != 1',
      )
      .andWhere(
        isL16
          ? '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)'
          : '1=1',
      )
      .groupBy('product.pro_code')
      .addGroupBy('newArrival.id')
      .addGroupBy('newArrival.createdAt')
      .addGroupBy('cart.spc_id')
      .addGroupBy('cart.spc_amount')
      .addGroupBy('cart.spc_unit')
      .addGroupBy('cart.mem_code')
      .orderBy('newArrival.createdAt', 'DESC')
      .addOrderBy('newArrival.id', 'DESC')
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
