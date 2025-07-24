import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ProductEntity } from './products.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async createProduct(product: ProductEntity) {
    try {
      const newProduct = this.productRepo.create(product);
      await this.productRepo.save(newProduct);
    } catch (error) {
      console.error('Error creating product:', error);
      throw new Error('Error creating product');
    }
  }

  async updateProduct(product: ProductEntity) {
    try {
      await this.productRepo.update({ pro_code: product.pro_code }, product);
      console.log('Product Update Sucesss');
    } catch (error) {
      console.error('Error updating product:', error);
    }
  }

  async getProductDetail(pro_code: string): Promise<ProductEntity> {
    try {
      const product = await this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.pharmaDetails', 'pharma')
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_barcode1',
          'product.pro_barcode2',
          'product.pro_barcode3',
          'product.pro_imgmain',
          'product.pro_img2',
          'product.pro_img3',
          'product.pro_img4',
          'product.pro_img5',
          'product.pro_ratio1',
          'product.pro_ratio2',
          'product.pro_ratio3',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_keysearch',
          'pharma.pro_code',
          'pharma.pp_properties',
          'pharma.pp_properties',
          'pharma.pp_how_to_use',
          'pharma.pp_caution',
          'pharma.pp_suggestion',
        ])
        .where('product.pro_code = :pro_code', { pro_code })
        .getOne();
      if (product) {
        return product;
      } else {
        throw new Error('Not found Product');
      }
    } catch {
      throw new Error('Something Error in Product Detail');
    }
  }

  async productForYou(data: {
    keyword: string;
    pro_code: string;
  }): Promise<ProductEntity[]> {
    try {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            }).orWhere('product.pro_keysearch LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            });
          }),
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_code != :pro_code', {
              pro_code: data.pro_code,
            })
              .andWhere('product.pro_name NOT LIKE :prefix1', {
                prefix1: 'ฟรี%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', { prefix4: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix5', {
                prefix5: '/%',
              });
          }),
        );

      const products = await qb
        .take(6)
        .select([
          // 'product.pro_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_unit1',
        ])
        .getMany();
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async searchProducts(data: {
    keyword: string;
    offset: number;
  }): Promise<{ products: ProductEntity[]; totalCount: number }> {
    try {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            }).orWhere('product.pro_keysearch LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            });
          }),
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', { prefix4: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix5', {
                prefix5: '/%',
              });
          }),
        );

      const totalCount = await qb.getCount();
      const products = await qb
        .take(30)
        .skip(data.offset)
        .select([
          // 'product.pro_id',
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_unit1',
        ])
        .getMany();
      return { products, totalCount };
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async listFree() {
    try {
      const data = await this.productRepo.find({
        where: {
          pro_free: true,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_point: true,
          pro_imgmain: true,
          pro_unit1: true,
        },
      });
      return data;
    } catch (error) {
      console.error('Error free products:', error);
      throw new Error('Error free products');
    }
  }
}
