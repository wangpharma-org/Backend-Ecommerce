import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';

interface OrderItem {
  pro_code: string;
  unit: string;
  quantity: number;
}

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductPharmaEntity)
    private readonly productPharmaEntity: Repository<ProductPharmaEntity>,
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

  async createProductPharmaRepo(detail: ProductPharmaEntity) {
    try {
      const newDetail = this.productPharmaEntity.create(detail);
      await this.productPharmaEntity.save(newDetail);
    } catch (error) {
      console.error('Error creating product detail:', error);
      throw new Error('Error creating product detail');
    }
  }

  async updateProductDetail(product: ProductPharmaEntity) {
    try {
      await this.productPharmaEntity.update(
        { product: { pro_code: product.product.pro_code } },
        product,
      );
      console.log('Product Detail Update Sucesss');
    } catch (error) {
      console.error('Error updating product detail:', error);
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

  async getProductDetail(data: {
    pro_code: string;
    mem_code: string;
  }): Promise<ProductEntity> {
    try {
      const product = await this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect('product.pharmaDetails', 'pharma')
        .leftJoinAndSelect(
          'product.inFavorite',
          'favorite',
          'favorite.mem_code = :mem_code',
          { mem_code: data.mem_code },
        )
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
          'favorite.fav_id',
        ])
        .where('product.pro_code = :pro_code', { pro_code: data.pro_code })
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

  // ฟังก์ชันดึงข้อมูลสินค้าพร้อมหน่วยจากฐานข้อมูล
  private async getProductsWithUnits(pro_code: string) {
    const products = await this.productRepo
      .createQueryBuilder('product')
      .where('product.pro_code = :pro_code', { pro_code })
      .select([
        'product.pro_code',
        'product.pro_unit1',
        'product.pro_ratio1',
        'product.pro_unit2',
        'product.pro_ratio2',
        'product.pro_unit3',
        'product.pro_ratio3',
      ])
      .getMany();

    // แปลงข้อมูลให้อยู่ในรูปแบบ units array
    return products.map((product: any) => ({
      ...product,
      units: [
        { unit: product.pro_unit1, ratio: product.pro_ratio1 },
        { unit: product.pro_unit2, ratio: product.pro_ratio2 },
        { unit: product.pro_unit3, ratio: product.pro_ratio3 },
      ].filter(u => u.unit), // กรอง unit ที่ไม่มีค่า
    }));
  }

 
  async calculateSmallestUnit(order: OrderItem[]): Promise<number> {
    let total = 0;
    try {
      // ลูปผ่านทุก orderItem
      for (const orderItem of order) {
        const { unit, quantity, pro_code } = orderItem;

        const productsWithUnits = await this.getProductsWithUnits(pro_code);

        const product = productsWithUnits.find(p => p.pro_code === pro_code);
        if (!product) {
          throw new Error(`Product with code ${pro_code} not found`);
        }

        const unitData = product.units.find(u => u.unit === unit);
        if (unitData) {
          const totalForItem = quantity * unitData.ratio; // คำนวณหน่วยที่เล็กที่สุดสำหรับแต่ละ orderItem

          total += totalForItem; // บวกผลลัพธ์เข้ากับ total รวม

          // console.log(`pro_code: ${pro_code}, Unit: ${unit}, Quantity: ${quantity}, Total for ${pro_code}: ${totalForItem}`);
        }
      }

      return total; // ส่งผลลัพธ์ที่เป็นตัวเลข
    } catch (error) {
      console.error('Error calculating smallest unit:', error);
      throw new Error('Error calculating smallest unit');
    }
  }


  // async ShowUnitProduct(pro_code: string): Promise<ProductEntityUnit> {
  //   try {
  //     const product = await this.productRepo
  //       .createQueryBuilder('product')
  //       .where('product.pro_code = :pro_code', { pro_code })
  //       .select([
  //         'product.pro_code',
  //         'product.pro_name',
  //         'product.pro_unit1',
  //         'product.pro_ratio1',
  //         'product.pro_unit2',
  //         'product.pro_ratio2',
  //         'product.pro_unit3',
  //         'product.pro_ratio3'
  //       ])
  //       .getOne();

  //     console.log('Product:', product);

  //     if (!product) {
  //       throw new Error('Product not found');
  //     }

  //     const formattedResult = {
  //       pro_code: product.pro_code,
  //       pro_name: product.pro_name,
  //       Unit1: {
  //         unit: product.pro_unit1,
  //         ratio: product.pro_ratio1
  //       },
  //       Unit2: {
  //         unit: product.pro_unit2,
  //         ratio: product.pro_ratio2
  //       },
  //       Unit3: {
  //         unit: product.pro_unit3,
  //         ratio: product.pro_ratio3
  //       }
  //     };
  //     console.log("formattedResult", formattedResult);

  //     return formattedResult;
  //   } catch (error) {
  //     console.error('Error calculating unit:', error);
  //     throw new Error('Error calculating unit');
  //   }
  // }
}
