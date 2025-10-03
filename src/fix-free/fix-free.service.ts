import { Repository } from 'typeorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProductEntity } from 'src/products/products.entity';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class FixFreeService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productEntity: Repository<ProductEntity>,
  ) {}

  async addProductFree(data: { pro_code: string; pro_point: number }) {
    try {
      const product = await this.productEntity.findOne({
        where: {
          pro_code: data.pro_code,
        },
      });
      if (!product) {
        throw new HttpException(
          { success: false, message: 'Product not found' },
          HttpStatus.NOT_FOUND,
        );
      }
      if (product.pro_stock < 1) {
        throw new HttpException(
          { success: false, message: 'Product Stock is Invalid' },
          HttpStatus.BAD_REQUEST,
        );
      }
      await this.productEntity.update(
        {
          pro_code: data.pro_code,
        },
        {
          pro_free: true,
          pro_point: data.pro_point,
        },
      );
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new Error('Something Error add Product Free');
    }
  }

  async removeProductFree(pro_code: string) {
    try {
      await this.productEntity.update(
        {
          pro_code: pro_code,
        },
        {
          pro_free: false,
        },
      );
    } catch {
      throw new Error('Something Error remove Product Free');
    }
  }

  async editPoint(pro_code: string, pro_point: number) {
    try {
      await this.productEntity.update(
        {
          pro_code: pro_code,
        },
        {
          pro_point: pro_point,
        },
      );
    } catch {
      throw new Error('Something Error edit Point Product Free');
    }
  }

  async getAllProductFree() {
    try {
      return await this.productEntity.find({
        where: {
          pro_free: true,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_point: true,
          pro_imgmain: true,
        },
      });
    } catch {
      throw new Error('Something Error get All Product Free');
    }
  }
}
