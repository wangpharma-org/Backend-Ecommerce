import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, IsNull, MoreThan, Not, Repository } from 'typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { Cron } from '@nestjs/schedule';
import { CreditorEntity } from './creditor.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BackendService } from 'src/backend/backend.service';

interface OrderItem {
  pro_code: string;
  unit: string;
  quantity: number;
}

// interface UpdateProductInput {
//   pro_code: string;
//   pro_name: string;
//   pro_lowest_stock: number;
//   priceA: number;
//   priceB: number;
//   priceC: number;
//   ratio1: number;
//   ratio2: number;
//   ratio3: number;
//   unit1: string;
//   unit2: string;
//   unit3: string;
//   supplier: string;
// }

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CreditorEntity)
    private readonly creditorRepo: Repository<CreditorEntity>,
    @InjectRepository(ProductPharmaEntity)
    private readonly productPharmaEntity: Repository<ProductPharmaEntity>,
    private readonly backendService: BackendService,
  ) {}

  async addCreditor(data: { creditor_code: string; creditor_name: string }) {
    try {
      const newCreditor = this.creditorRepo.create(data);
      await this.creditorRepo.save(newCreditor);
    } catch (error) {
      console.error('Error creating creditor:', error);
      throw new Error('Error creating creditor');
    }
  }

  async getProductByCreditor(creditor_code: string) {
    try {
      const qb = this.productRepo.createQueryBuilder('product');

      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
        ])
        .where('product.creditor_code = :creditor_code', { creditor_code })
        .andWhere('product.pro_name NOT LIKE :p1', { p1: 'ฟรี%' })
        .andWhere('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_priceA > 0')
        .andWhere('product.pro_priceB > 0')
        .andWhere('product.pro_priceC > 0')
        .getMany();

      return data;
    } catch (error) {
      console.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearch() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .getMany();
      return data;
    } catch (error) {
      console.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearchForFlashSale() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_imgmain',
          'product.pro_stock',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .getMany();
      return data;
    } catch (error) {
      console.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductForKeySearchForRecommend() {
    try {
      const qb = this.productRepo.createQueryBuilder('product');
      const data = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_genericname',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_imgmain',
          'product.pro_stock',
        ])
        .where('product.pro_name NOT LIKE :p2', { p2: '@%' })
        .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
        .andWhere('product.pro_name NOT LIKE :p3', { p3: 'ส่งเสริม%' })
        .andWhere('product.pro_name NOT LIKE :p4', { p4: 'รีเบท%' })
        .andWhere('product.pro_name NOT LIKE :p5', { p5: '-%' })
        .andWhere('product.pro_name NOT LIKE :p6', { p6: '/%' })
        .andWhere('product.pro_name NOT LIKE :p7', { p7: 'ค่า%' })
        .andWhere('product.pro_name NOT LIKE :p8', { p8: 'ฟรี%' })
        .andWhere('product.recommend_id IS NULL')
        .getMany();
      return data;
    } catch (error) {
      console.error('Error in getProductByCreditor', error);
      throw error;
    }
  }

  async getProductOne(pro_code: string) {
    try {
      // console.log('getProductOne', pro_code);
      const dataProduct = await this.productRepo.findOne({
        relations: {
          flashsale: {
            flashsale: true,
          },
        },
        where: {
          pro_code: pro_code,
        },
      });
      // console.log(dataProduct);
      return dataProduct;
    } catch {
      throw new Error('Something Error in getProductOne');
    }
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  async resetFlashSale() {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    if (tomorrow.getDate() !== 1) {
      return;
    }
    try {
      await this.productRepo.update(
        { pro_promotion_month: Not(IsNull()) },
        {
          pro_promotion_month: null,
          pro_promotion_amount: null,
          is_detect_amount: false,
        },
      );
      console.log('Reset FlashSale Success');
    } catch (error) {
      console.log(error);
      throw new Error('Error Reset FlashSale');
    }
  }

  async listProcodeFlashSale() {
    try {
      const data = await this.productRepo.find({
        where: {
          pro_promotion_month: Not(IsNull()),
        },
        select: {
          pro_code: true,
        },
      });
      return data;
    } catch (error) {
      throw new Error('Error in listProcodeFlashSale: ', error);
    }
  }

  async getFlashSale(limit: number, mem_code: string) {
    try {
      console.log(limit, mem_code);
      const numberOfMonth = new Date().getMonth() + 1;
      const data = await this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :mem_code',
          { mem_code },
        )
        .where('product.pro_promotion_month = :month', { month: numberOfMonth })
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_imgmain',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_promotion_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
        ])
        .take(Number(limit))
        .getMany();

      return data;
    } catch (error) {
      console.error('Error in getFlashSale:', error);
      throw new Error('Error in getFlashSale');
    }
  }

  async uploadProductFlashSale(
    data: {
      productCode: string;
      quantity: number;
    }[],
  ) {
    try {
      const rows = Object.values(data);
      const numberOfMonth = new Date().getMonth() + 1;
      await Promise.all(
        rows.map(async (item) => {
          await this.productRepo.update(
            { pro_code: item.productCode },
            {
              pro_promotion_month: numberOfMonth,
              pro_promotion_amount: item.quantity === 0 ? 1 : item.quantity,
              is_detect_amount: item.quantity === 0 ? false : true,
            },
          );
        }),
      );
      const responseData = this.productRepo.find({
        where: {
          pro_promotion_month: numberOfMonth,
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_promotion_month: true,
          pro_promotion_amount: true,
          is_detect_amount: true,
        },
      });
      return responseData;
    } catch (error) {
      console.error('Error uploading product flash sale:', error);
      throw new Error('Error uploading product flash sale');
    }
  }

  async uploadPO(data: { pro_code: string; month: number }[]) {
    // console.log(data);
    try {
      await this.productRepo.update(
        { pro_promotion_month: Not(IsNull()) },
        {
          pro_promotion_month: null,
          pro_promotion_amount: null,
          is_detect_amount: false,
        },
      );

      const rows = Object.values(data);
      await Promise.all(
        rows.map(async (item) => {
          await this.productRepo.update(
            { pro_code: item.pro_code },
            {
              pro_promotion_month: item.month,
              pro_promotion_amount: 1,
            },
          );
        }),
      );
      console.log('Product Promotion Month Update Success');
      return 'Product Promotion Month Update Success (PO File)';
    } catch (error) {
      console.log(error);
      throw new Error('Error updating product promotion month');
    }
  }

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
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .leftJoinAndSelect('product.recommend', 'recommend')
        .leftJoinAndSelect(
          'recommend.products',
          'products',
          'products.pro_stock > products.pro_lowest_stock AND products.pro_stock > 0'
        )
        .leftJoinAndSelect('products.inCarts', 'inCarts')
        .leftJoinAndSelect('products.flashsale', 'fsp_products')
        .leftJoinAndSelect('fsp_products.flashsale', 'fs_products')
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
          'product.pro_promotion_month',
          'product.pro_promotion_amount',
          'product.pro_keysearch',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'product.sale_amount_day',
          'pharma.pro_code',
          'pharma.pp_properties',
          'pharma.pp_properties',
          'pharma.pp_how_to_use',
          'pharma.pp_caution',
          'pharma.pp_suggestion',
          'favorite.fav_id',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
          'recommend.id',
          'products.pro_code',
          'products.pro_name',
          'products.pro_imgmain',
          'products.pro_priceA',
          'products.pro_priceB',
          'products.pro_priceC',
          'products.pro_unit1',
          'products.pro_unit2',
          'products.pro_unit3',
          'products.pro_stock',
          'products.pro_lowest_stock',
          'products.order_quantity',
          'products.pro_promotion_amount',
          'products.pro_promotion_month',
          'products.recommend_rank',
          'inCarts.mem_code',
          'inCarts.spc_amount',
          'inCarts.spc_unit',
          'fsp_products.limit',
          'fsp_products.id',
          'fs_products.promotion_id',
          'fs_products.time_start',
          'fs_products.time_end',
          'fs_products.date',
        ])
        .where('product.pro_code = :pro_code', { pro_code: data.pro_code })
        .getOne();
      if (product) {
        return product;
      } else {
        throw new Error('Not found Product');
      }
    } catch (error) {
      console.log(error);
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
              })
              .andWhere('product.pro_name NOT LIKE :rebase', {
                rebase: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :message', {
                message: '@%',
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
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
        ])
        .getMany();
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async searchCategoryProducts(data: {
    keyword: string;
    category: number;
    offset: number;
    mem_code: string;
    sort_by?: number;
    limit: number;
  }): Promise<{ products: ProductEntity[]; totalCount: number }> {
    try {
      const now = new Date();
      const monthNumber = now.getMonth() + 1;
      const currentDate = now.toISOString().split('T')[0];
      const currentTime = now.toTimeString().split(' ')[0];

      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode',
          { memCode: data.mem_code },
        )
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs');

      if (data.category === 8) {
        qb.where('product.pro_free = :free', { free: true })
          .andWhere('product.pro_point > :point', { point: 0 })
          .andWhere('product.pro_stock > :stock', { stock: 0 });
      } else {
        qb.where('product.pro_priceA != 0')
          .andWhere(
            new Brackets((qb) => {
              qb.where('product.pro_name LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
                .orWhere('product.pro_keysearch LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode1 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode2 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_barcode3 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_code LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_nameMain LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain2 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain3 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_drugmain4 LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                })
                .orWhere('product.pro_nameTH LIKE :keyword', {
                  keyword: `%${data.keyword}%`,
                });
            }),
          )
          .andWhere(
            new Brackets((qb) => {
              qb.where('product.pro_name NOT LIKE :prefix1', {
                prefix1: 'ฟรี%',
              })
                .andWhere('product.pro_name NOT LIKE :prefix2', {
                  prefix2: '@%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix3', {
                  prefix3: 'ส่งเสริม%',
                })
                .andWhere('product.invisible_id IS NULL')
                .andWhere('product.pro_name NOT LIKE :prefix4', {
                  prefix4: 'รีเบท%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix5', {
                  prefix5: '-%',
                })
                .andWhere('product.pro_name NOT LIKE :prefix6', {
                  prefix6: '/%',
                })
                .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
                .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
                .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
                .andWhere('product.pro_name NOT LIKE :prefix7', {
                  prefix7: 'ค่า%',
                });

              if (data.category === 7) {
                qb.andWhere('product.pro_promotion_month = :month', {
                  month: monthNumber,
                });
              } else if (data.category === 9) {
                qb.andWhere('fs.date = :date', { date: currentDate });
                qb.andWhere(':nowTime BETWEEN fs.time_start AND fs.time_end', {
                  nowTime: currentTime,
                });
              } else {
                qb.andWhere('product.pro_category = :category', {
                  category: data.category,
                });
              }
            }),
          );
      }

      if (data.sort_by && data.category === 8) {
        switch (data.sort_by) {
          case 1:
            qb.orderBy('product.pro_stock', 'DESC');
            break;
          case 2:
            qb.orderBy('product.pro_stock', 'ASC');
            break;
          case 3:
            qb.orderBy('product.pro_point', 'DESC');
            break;
          case 4:
            qb.orderBy('product.pro_point', 'ASC');
            break;
          case 5:
            qb.orderBy('product.pro_sale_amount', 'DESC');
            break;
          default:
            qb.orderBy('product.pro_name', 'ASC');
        }
      } else if (data.sort_by) {
        switch (data.sort_by) {
          case 1:
            qb.orderBy('product.pro_stock', 'DESC');
            break;
          case 2:
            qb.orderBy('product.pro_stock', 'ASC');
            break;
          case 3:
            qb.orderBy('product.pro_priceA', 'DESC');
            break;
          case 4:
            qb.orderBy('product.pro_priceA', 'ASC');
            break;
          case 5:
            qb.orderBy('product.pro_sale_amount', 'DESC');
            break;
          default:
            qb.orderBy('product.pro_name', 'ASC');
        }
      } else {
        qb.orderBy('product.pro_name', 'ASC');
      }

      const totalCount = await qb.getCount();
      const products = await qb
        .take(data.limit)
        .skip(data.offset)
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_point',
          'product.pro_promotion_amount',
          'product.pro_promotion_month',
          'product.pro_sale_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
        ])
        .getMany();

      return { products, totalCount };
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async searchProducts(data: {
    keyword: string;
    offset: number;
    mem_code: string;
    sort_by?: number;
    limit: number;
  }): Promise<{ products: ProductEntity[]; totalCount: number }> {
    try {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :memCode',
          { memCode: data.mem_code },
        )
        .leftJoinAndSelect('product.flashsale', 'fsp')
        .leftJoinAndSelect('fsp.flashsale', 'fs')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name LIKE :keyword', {
              keyword: `%${data.keyword}%`,
            })
              .orWhere('product.pro_keysearch LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_nameEN LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_barcode1 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_barcode2 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_barcode3 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_code LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_nameMain LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_drugmain LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_drugmain2 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_drugmain3 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_drugmain4 LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              })
              .orWhere('product.pro_nameTH LIKE :keyword', {
                keyword: `%${data.keyword}%`,
              });
          }),
        )
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.invisible_id IS NULL')
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', {
                prefix4: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix5', { prefix5: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :prefix8', {
                prefix8: '@M%',
              });
          }),
        );

      if (data.sort_by) {
        switch (data.sort_by) {
          case 1:
            qb.orderBy('product.pro_stock', 'DESC');
            break;
          case 2:
            qb.orderBy('product.pro_stock', 'ASC');
            break;
          case 3:
            qb.orderBy('product.pro_priceA', 'DESC');
            break;
          case 4:
            qb.orderBy('product.pro_priceA', 'ASC');
            break;
          case 5:
            qb.orderBy('product.pro_sale_amount', 'DESC');
            break;
          default:
            qb.orderBy('product.pro_name', 'ASC');
        }
      } else {
        qb.orderBy('product.pro_name', 'ASC');
      }

      const totalCount = await qb.getCount();
      const products = await qb
        .take(data.limit)
        .skip(data.offset)
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_sale_amount',
          'product.pro_stock',
          'product.pro_lowest_stock',
          'product.order_quantity',
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.mem_code',
          'fsp.limit',
          'fsp.id',
          'fs.promotion_id',
          'fs.time_start',
          'fs.time_end',
          'fs.date',
        ])
        .getMany();
      return { products, totalCount };
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async listFree(sort_by?: string) {
    // console.log('sort_by', sort_by);
    try {
      let order: Record<string, 'ASC' | 'DESC'>;

      switch (sort_by) {
        case '1':
          order = { pro_stock: 'DESC' };
          break;
        case '2':
          order = { pro_stock: 'ASC' };
          break;
        case '3':
          order = { pro_point: 'DESC' };
          break;
        case '4':
          order = { pro_point: 'ASC' };
          break;
        case '5':
          order = { pro_sale_amount: 'DESC' };
          break;
        default:
          order = { pro_name: 'ASC' };
      }

      const data = await this.productRepo.find({
        where: {
          pro_free: true,
          pro_stock: MoreThan(0),
          pro_point: MoreThan(0),
        },
        select: {
          pro_code: true,
          pro_name: true,
          pro_point: true,
          pro_imgmain: true,
          pro_unit1: true,
          pro_sale_amount: true,
          pro_stock: true,
        },
        order,
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
      ].filter((u) => u.unit), // กรอง unit ที่ไม่มีค่า
    }));
  }

  async calculateSmallestUnit(order: OrderItem[]): Promise<number> {
    let total = 0;
    try {
      // ลูปผ่านทุก orderItem
      for (const orderItem of order) {
        const { unit, quantity, pro_code } = orderItem;

        const productsWithUnits = await this.getProductsWithUnits(pro_code);

        const product = productsWithUnits.find((p) => p.pro_code === pro_code);
        if (!product) {
          throw new Error(`Product with code ${pro_code} not found`);
        }

        const unitData = product.units.find((u) => u.unit === unit);
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

  // ตรวจสอบแล้ว

  async searchByCodeOrSupplier(keyword: string): Promise<ProductEntity[]> {
    try {
      const products = await this.productRepo
        .createQueryBuilder('product')
        .where(
          new Brackets((qb) => {
            qb.where('product.pro_code LIKE :keyword', {
              keyword: `%${keyword}%`,
            }).orWhere('product.pro_supplier LIKE :keyword', {
              keyword: `%${keyword}%`,
            });
          }),
        )
        .andWhere('product.pro_priceA != :price', { price: 1 })
        .andWhere('product.pro_code NOT LIKE :at1', { at1: '@M%' })
        .andWhere('product.pro_code NOT LIKE :at2', { at2: '%/%' })
        .andWhere('product.pro_code NOT LIKE :at3', { at3: '%@%' })
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :n1', { n1: 'ฟรี%' })
              .andWhere('product.pro_name NOT LIKE :n2', { n2: '%โอน%' })
              .andWhere('product.pro_name NOT LIKE :n3', { n3: '%ค่า%' })
              .andWhere('product.pro_name NOT LIKE :n4', { n4: '%ขนส่ง%' })
              .andWhere('product.pro_name NOT LIKE :n5', { n5: '%โปรโมชั่น%' });
          }),
        )
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_barcode1',
          'product.pro_barcode2',
          'product.pro_barcode3',
          'product.pro_imgmain',
        ])
        .take(10)
        .getMany();
      return products;
    } catch (error) {
      console.error('Error searching by code or supplier:', error);
      throw new Error('Error searching by code or supplier');
    }
  }

  async getAllProducts(): Promise<ProductEntity[]> {
    try {
      const products = await this.productRepo.find({
        order: { pro_code: 'ASC' },
      });
      return products;
    } catch (error) {
      console.error('Error fetching all products:', error);
      throw new Error('Error fetching all products');
    }
  }

  async updateProductFromBackOffice(body: {
    group: {
      pro_code: string;
      pro_name: string;
      priceA: number;
      priceB: number;
      priceC: number;
      ratio1: number;
      ratio2: number;
      ratio3: number;
      unit1: string;
      unit2: string;
      unit3: string;
      supplier: string;
      pro_lowest_stock: number;
      order_quantity: number;
    }[];
    filename: string;
  }): Promise<string> {
    const queryRunner = this.productRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      for (const item of body.group) {
        const hasValueNonZero = (v) =>
          v !== undefined && v !== null && v !== '' && Number(v) !== 0;
        let ratio2 = 1;
        let ratio3 = 1;

        const ratio1 = 1;

        if (!item.unit2) {
          ratio2 = 1;
        } else {
          ratio2 = hasValueNonZero(item.ratio2)
            ? Math.trunc(Number(item.ratio1) / Number(item.ratio2))
            : 0;
        }

        if (!item.unit3) {
          ratio3 = 1;
        } else {
          ratio3 = hasValueNonZero(item.ratio3)
            ? Math.trunc(Number(item.ratio1) / Number(item.ratio3))
            : 0;
        }

        const updateData: Partial<ProductEntity> = {
          pro_code: item?.pro_code,
          pro_name: item?.pro_name || '',
          pro_lowest_stock: item?.pro_lowest_stock || 0,
          pro_priceA: item?.priceA || 0,
          pro_priceB: item?.priceB || 0,
          pro_priceC: item?.priceC || 0,
          pro_ratio1: ratio1 || 1,
          pro_ratio2: ratio2 || 1,
          pro_ratio3: ratio3 || 1,
          pro_unit1: item?.unit1 || '',
          pro_unit2: item?.unit2 || '',
          pro_unit3: item?.unit3 || '',
          creditor: null,
          order_quantity: item.order_quantity || 0,
        };
        // Assign creditor as entity or null if not found or error
        if (item?.supplier) {
          let supplierCode = item.supplier;
          if (supplierCode.startsWith('N')) {
            supplierCode = supplierCode.substring(1);
          }
          try {
            const foundCreditor = await this.creditorRepo.findOne({
              where: { creditor_code: supplierCode },
            });
            if (foundCreditor) {
              updateData.creditor = foundCreditor;
            } else {
              updateData.creditor = null;
            }
          } catch {
            updateData.creditor = null;
          }
        }
        const existing = await queryRunner.manager.findOne(ProductEntity, {
          where: { pro_code: item?.pro_code },
        });
        if (existing) {
          await queryRunner.manager.update(
            ProductEntity,
            { pro_code: item?.pro_code },
            updateData,
          );
        } else {
          await queryRunner.manager.save(ProductEntity, updateData);
        }
      }
      await queryRunner.manager.update(
        LogFileEntity,
        { feature: `UpdateProduct` },
        {
          filename: body.filename,
          uploadedAt: new Date(),
        },
      );
      await queryRunner.commitTransaction();
      console.log(`Products updated/inserted successfully.`);
      return `Products updated/inserted successfully.`;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      console.error(`Error updating/inserting products:`, error);
      throw new Error(`Error updating/inserting products`);
    } finally {
      await queryRunner.release();
    }
  }

  async updateStock(body: {
    group: { pro_code: string; stock: number }[];
    filename: string;
  }): Promise<string> {
    try {
      for (const item of body.group) {
        await this.productRepo.update(
          { pro_code: item.pro_code },
          { pro_stock: item.stock },
        );
      }
      await this.backendService.updateLogFile(
        { feature: 'UpdateStock' },
        { filename: body.filename, uploadedAt: new Date() },
      );
      return 'Stock updated successfully';
    } catch (error) {
      console.error('Error updating stock:', error);
      throw new Error('Error updating stock');
    }
  }

  async keySearchProducts() {
    try {
      const qb = this.productRepo
        .createQueryBuilder('product')
        .where('product.pro_priceA != 0')
        .andWhere(
          new Brackets((qb) => {
            qb.where('product.pro_name NOT LIKE :prefix1', { prefix1: 'ฟรี%' })
              .andWhere('product.pro_code NOT LIKE :code', { code: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix2', { prefix2: '@%' })
              .andWhere('product.pro_name NOT LIKE :prefix3', {
                prefix3: 'ส่งเสริม%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix4', {
                prefix4: 'รีเบท%',
              })
              .andWhere('product.pro_name NOT LIKE :prefix5', { prefix5: '-%' })
              .andWhere('product.pro_name NOT LIKE :prefix6', {
                prefix6: '/%',
              })
              .andWhere('product.pro_priceA > :zero1', { zero1: 0 })
              .andWhere('product.pro_priceB > :zero2', { zero2: 0 })
              .andWhere('product.pro_priceC > :zero3', { zero3: 0 })
              .andWhere('product.invisible_id IS NULL')
              .andWhere('product.pro_name NOT LIKE :prefix7', {
                prefix7: 'ค่า%',
              })
              .andWhere('product.pro_code NOT LIKE :prefix8', {
                prefix8: '@M%',
              });
          }),
        );

      const products = await qb
        .select([
          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_genericname',
          'product.pro_unit1',
          'product.pro_nameSale',
          'product.pro_nameEN',
          'product.pro_keysearch',
        ])
        .getMany();
      return products;
    } catch (error) {
      console.error('Error searching products:', error);
      throw new Error('Error searching products');
    }
  }

  async findProductFree(): Promise<{ pro_code: string; pro_name: string }[]> {
    try {
      const products = await this.productRepo.find({
        where: { pro_free: true },
      });
      return products.map((product) => ({
        pro_code: product.pro_code,
        pro_name: product.pro_name,
      }));
    } catch (error) {
      console.error('Error finding free products:', error);
      throw new Error('Error finding free products');
    }
  }

  async findProductPromotion(): Promise<
    {
      pro_code: string;
      pro_promotion_month: number;
      pro_promotion_amount: number;
    }[]
  > {
    try {
      const products = await this.productRepo.find({
        where: { pro_promotion_month: MoreThan(0) },
        select: ['pro_code', 'pro_promotion_month', 'pro_promotion_amount'],
      });
      return products.map((product) => ({
        pro_code: product.pro_code,
        pro_promotion_month: product.pro_promotion_month || 0,
        pro_promotion_amount: product.pro_promotion_amount || 0,
      }));
    } catch (error) {
      console.error('Error finding promotion products:', error);
      throw new Error('Error finding promotion products');
    }
  }
  async updateSaleDayly(data: { pro_code: string; amount: number }[]) {
    try {
      await this.productRepo.update(
        { pro_code: Not(IsNull()) },
        { sale_amount_day: null },
      );

      for (const item of data) {
        await this.productRepo.update(
          { pro_code: item.pro_code },
          { sale_amount_day: item.amount },
        );
      }
    } catch (error) {
      console.error('Error updating sale amount day:', error);
      throw new Error('Error updating sale amount day');
    }
  }
}
