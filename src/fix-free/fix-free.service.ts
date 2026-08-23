import { Repository } from 'typeorm';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ProductEntity } from 'src/products/products.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  buildRedeemCandidateWhere,
  isRedeemProductVisible,
} from 'src/products/redeem-product.criteria';

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
          // เคลียร์แต้มด้วย ไม่งั้นสินค้า product_type = '00' ยังโผล่หน้าแลกแต้มอยู่
          pro_free: false,
          pro_point: 0,
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

  // หน้าแอดมิน — คืนสินค้ากลุ่มแลกแต้มครบทุกตัว แม้แต้มหรือสต็อกจะยังไม่พร้อม
  // แล้วแนบ is_visible บอกว่าตอนนี้ลูกค้าเห็นไหม
  async getAllProductFree() {
    try {
      const products = await this.productEntity.find({
        where: buildRedeemCandidateWhere(),
        select: {
          pro_code: true,
          pro_name: true,
          pro_point: true,
          pro_imgmain: true,
          pro_stock: true,
          pro_free: true,
          product_type: true,
        },
      });

      return products.map((product) => ({
        ...product,
        is_visible: isRedeemProductVisible(product),
      }));
    } catch {
      throw new Error('Something Error get All Product Free');
    }
  }
}
