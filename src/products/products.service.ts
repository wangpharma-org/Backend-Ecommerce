import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductEntity } from './products.entity';
@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async createProduct(product: ProductEntity): Promise<ProductEntity> {
    try {
      const newProduct = this.productRepo.create(product);
      return await this.productRepo.save(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error('Error creating product');
    }
  }

  async searchProducts(data: {
    keyword: string;
    offset: number;
  }): Promise<ProductEntity[]> {
    try {
      const products = await this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_name LIKE :keyword', {
          keyword: `%${data.keyword}%`,
        })
        .orWhere('JSON_CONTAINS(product.pro_keysearch, :jsonKeyword)', {
          jsonKeyword: JSON.stringify(data.keyword),
        })
        .take(30)
        .skip(data.offset)
        .select([
          'product.pro_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_nameEN',
          'product.pro_nameSale',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
        ])
        .getMany();
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }
}
