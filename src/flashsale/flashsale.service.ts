import { Injectable } from '@nestjs/common';
import { FlashSaleEntity } from './flashsale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

@Injectable()
export class FlashsaleService {
  constructor(
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepo: Repository<FlashSaleEntity>,
  ) {}

  async getListFlashSale() {
    try {
      const data = await this.flashSaleRepo.find({
        relations: {
          product: true,
        },
        select: {
          product: {
            pro_code: true,
            pro_name: true,
            pro_priceA: true,
            pro_imgmain: true,
            pro_unit1: true,
          },
        },
        take: 6,
      });
      return data;
    } catch (error) {
      console.log(error);
      throw new Error('Something Error in getListFlashSale');
    }
  }
}
