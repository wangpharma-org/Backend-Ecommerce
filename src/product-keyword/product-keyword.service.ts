import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Injectable()
export class ProductKeywordService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async updateKeyword(data: {
    pro_code: string;
    keysearch: string;
    viewers: number;
  }) {
    try {
      await this.productRepo.update(
        {
          pro_code: data.pro_code,
        },
        {
          pro_keysearch: data.keysearch,
          viwers: data.viewers,
        },
      );
    } catch {
      throw new Error('Something Error in UpdateKeyword');
    }
  }

  async getProductOne(pro_code: string) {
    try {
      const dataProduct = await this.productRepo.findOne({
        where: {
          pro_code: pro_code,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_genericname: true,
          pro_keysearch: true,
          pro_imgmain: true,
          pro_barcode1: true,
          pro_barcode2: true,
          pro_barcode3: true,
          viwers: true,
        },
      });
      return dataProduct;
    } catch {
      throw new Error('Something Error in getProductOne');
    }
  }
}
