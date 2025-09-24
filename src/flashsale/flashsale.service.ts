import { Injectable } from '@nestjs/common';
import { FlashSaleEntity } from './flashsale.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FlashSaleProductsEntity } from './flashsale-product.entity';

@Injectable()
export class FlashsaleService {
  constructor(
    @InjectRepository(FlashSaleEntity)
    private readonly flashSaleRepo: Repository<FlashSaleEntity>,
    @InjectRepository(FlashSaleProductsEntity)
    private readonly flashSaleProductsRepo: Repository<FlashSaleProductsEntity>,
  ) {}

  async addFlashSale(data: {
    promotion_name: string;
    date: string;
    time_start: string;
    time_end: string;
    is_active: boolean;
  }) {
    try {
      this.flashSaleRepo.create(data);
      return await this.flashSaleRepo.save(data);
    } catch (error) {
      console.log(`${Date()} Error Something in addFlashSale`);
      console.log(error);
      throw new Error('Error Something in addFlashSale');
    }
  }

  async addProductToFlashSale(data: {
    promotion_id: number;
    pro_code: string;
    limit: number;
  }) {
    try {
      console.log(data);
      const payload = this.flashSaleProductsRepo.create({
        flashsale: { promotion_id: data.promotion_id },
        product: { pro_code: data.pro_code },
        limit: data.limit,
      });
      return await this.flashSaleProductsRepo.save(payload);
    } catch (error) {
      console.log(`${Date()} Error Something in addProductToFlashSale`);
      console.log(error);
      throw new Error('Error Something in addProductToFlashSale');
    }
  }

  async getAllFlashSales() {
    try {
      return await this.flashSaleRepo.find();
    } catch (error) {
      console.log(`${Date()} Error Something in getAllFlashSales`);
      console.log(error);
      throw new Error('Error Something in getAllFlashSales');
    }
  }

  async getProductsInFlashSale(promotion_id: number) {
    try {
      return await this.flashSaleProductsRepo.find({
        where: { flashsale: { promotion_id } },
        relations: {
          product: true,
        },
        select: {
          id: true,
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
            pro_genericname: true,
          },
          limit: true,
        },
      });
    } catch (error) {
      console.log(`${Date()} Error Something in getProductsInFlashSale`);
      console.log(error);
      throw new Error('Error Something in getProductsInFlashSale');
    }
  }
}
