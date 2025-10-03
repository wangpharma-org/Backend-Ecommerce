/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { InjectRepository } from '@nestjs/typeorm';
import { HotdealEntity } from './hotdeal.entity';
import { In, Repository } from 'typeorm';
export interface HotdealInput {
  pro_code: string;
  pro1_amount: string;
  pro1_unit: string;
  pro2_code: string;
  pro2_amount: string;
  pro2_unit: string;
}

@Injectable()
export class HotdealService {
  constructor(
    @InjectRepository(HotdealEntity)
    private readonly hotdealRepo: Repository<HotdealEntity>,
    private readonly productService: ProductsService,
  ) { }

  async find(pro_code: string): Promise<HotdealEntity | null> {
    return await this.hotdealRepo.findOne({
      where: { product: { pro_code } },
      relations: ['product', 'product2'],
      select: {
        product: {
          pro_code: true
        },
        product2: {
          pro_code: true
        }
      }
    });
  }

  async searchProduct(keyword: string) {
    return this.productService.searchByCodeOrSupplier(keyword);
  }

  async saveHotdeal(datainput: HotdealInput): Promise<HotdealEntity | null> {
    const hotdeal = this.hotdealRepo.create({
      pro1_amount: datainput.pro1_amount,
      pro1_unit: datainput.pro1_unit,
      pro2_amount: datainput.pro2_amount,
      pro2_unit: datainput.pro2_unit,
      product: { pro_code: datainput.pro_code },
      product2: { pro_code: datainput.pro2_code },
    });
    return this.hotdealRepo.save(hotdeal);
  }

  async getAllHotdealsWithProductNames() {
    const hotdeals = await this.hotdealRepo.find({
      relations: ['product', 'product2'],
      order: { id: 'DESC' },
    });
    // map เฉพาะชื่อสินค้าออกมา
    return hotdeals.map((hotdeal) => ({
      id: hotdeal.id,
      pro_code: hotdeal.product?.pro_code || null,
      pro2_code: hotdeal.product2?.pro_code || null,
      pro1_amount: hotdeal.pro1_amount,
      pro1_unit: hotdeal.pro1_unit,
      pro2_amount: hotdeal.pro2_amount,
      pro2_unit: hotdeal.pro2_unit,
      pro_name: hotdeal.product?.pro_name || null,
      pro2_name: hotdeal.product2?.pro_name || null,
    }));
  }

  async deleteHotdeal(id: number): Promise<{ message: string }> {
    const result = await this.hotdealRepo.delete(id);
    if ((result.affected ?? 0) > 0) {
      return { message: 'Hotdeal deleted successfully' };
    }
    throw new Error('Hotdeal not found');
  }

  async getAllHotdeals(): Promise<HotdealEntity[]> {
    return this.hotdealRepo.find({ order: { id: 'DESC' } });
  }

  async getAllHotdealsWithProductDetail(
    limit?: number,
    offset?: number,
    mem_code?: string,
  ) {
    const query = this.hotdealRepo
      .createQueryBuilder('hotdeal')
      .leftJoinAndSelect('hotdeal.product', 'product')
      .leftJoinAndSelect('hotdeal.product2', 'product2')
      .orderBy('hotdeal.id', 'DESC');

    // ถ้ามี mem_code ให้ join กับ shopping_cart
    if (mem_code) {
      console.log('Debug - mem_code provided:', mem_code);
      query
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :mem_code',
          { mem_code },
        )
        .leftJoinAndSelect(
          'product2.inCarts',
          'cart2',
          'cart2.mem_code = :mem_code',
          { mem_code },
        );
    }

    if (limit) {
      query.take(limit);
    }
    if (offset) {
      query.skip(offset);
    }

    const hotdeals = await query.getMany();

    console.log('Debug - Hotdeals count:', hotdeals.length);
    if (mem_code && hotdeals.length > 0) {
      console.log('Debug - First hotdeal product cart:', hotdeals[0].product?.inCarts);
      console.log('Debug - First hotdeal product2 cart:', hotdeals[0].product2?.inCarts);
    }

    // ปรับปรุงการ map โดยใช้ข้อมูลจาก query ที่ join มาแล้ว
    const result = hotdeals.map((hotdeal) => {
      type ProductType = {
        pro_code: string;
        pro_name: string;
        pro_priceA: number;
        pro_priceB: number;
        pro_priceC: number;
        pro_imgmain: string;
        pro_ratio1: number;
        pro_ratio2: number;
        pro_ratio3: number;
        pro_unit1: string;
        pro_unit2: string;
        pro_unit3: string;
        pro_stock: number;
        order_quantity: number;
        pro_lowest_stock: number;
        inCarts?: any[];
      };

      const pickProductFields = (product: ProductType | null | undefined) =>
        product
          ? {
              pro_code: product.pro_code,
              pro_name: product.pro_name,
              pro_priceA: product.pro_priceA,
              pro_priceB: product.pro_priceB,
              pro_priceC: product.pro_priceC,
              pro_imgmain: product.pro_imgmain,
              pro_ratio1: product.pro_ratio1,
              pro_ratio2: product.pro_ratio2,
              pro_ratio3: product.pro_ratio3,
              pro_unit1: product.pro_unit1,
              pro_unit2: product.pro_unit2,
              pro_unit3: product.pro_unit3,
              pro_stock: product.pro_stock,
              order_quantity: product.order_quantity,
              pro_lowest_stock: product.pro_lowest_stock,
            }
          : null;

      return {
        id: hotdeal.id,
        pro1_amount: hotdeal.pro1_amount,
        pro1_unit: hotdeal.pro1_unit,
        pro2_amount: hotdeal.pro2_amount,
        pro2_unit: hotdeal.pro2_unit,
        product: pickProductFields(hotdeal.product as ProductType),
        product2: pickProductFields(hotdeal.product2 as ProductType),
        // เพิ่มข้อมูล shopping_cart ถ้ามี
        shopping_cart: mem_code
          ? {
              product_cart: (hotdeal.product as ProductType)?.inCarts || [],
              product2_cart: (hotdeal.product2 as ProductType)?.inCarts || [],
            }
          : "ไม่เจอข้อมูล",
      };
    });

    return result;
  }

  async checkHotdealMatch(
    pro_code: string,
    shopping_cart: Array<{ pro1_unit: string; pro1_amount: string }>
  ): Promise<
    { pro_code: string; match: boolean; countFreeBies: string; amountInHotdeal: number } | undefined
  > {
    try {
      const found = await this.hotdealRepo.findOne({
        where: { product: { pro_code } },
        relations: ['product'],
      });
      console.log('Found hotdeal:', found?.product.pro_code);
      console.log('Raw shopping_cart input:', shopping_cart);
      console.log('Raw hotdeal data:', {
        pro1_amount: found?.pro1_amount,
        pro1_unit: found?.pro1_unit
      });
      let fromFrontend = 0;
      for (let i = 0; i < shopping_cart.length; i++) {
        const convertedFrontend = await this.convertToSmallestUnit(
          pro_code,
          shopping_cart[i].pro1_amount,
          shopping_cart[i].pro1_unit,
        );
        fromFrontend += convertedFrontend ?? 0;
      }
      console.log('Converted frontend amount:', fromFrontend);
      
      const fromDatabase = await this.convertToSmallestUnit(
        pro_code,
        found?.pro1_amount ?? '',
        found?.pro1_unit ?? '',
      );
      console.log('Converted database amount:', fromDatabase);
      
      let match = false;
      if (found) {
        const amountInCart = fromFrontend ?? 0;
        const amountInHotdeal = fromDatabase ?? 0;
        const cal = Math.floor(amountInCart / amountInHotdeal);
        
        console.log('Final calculation:');
        console.log('- amountInCart:', amountInCart);
        console.log('- amountInHotdeal:', amountInHotdeal);
        console.log('- division result:', amountInCart / amountInHotdeal);
        console.log('- Math.floor result:', cal);
        console.log('- cal >= 1?', cal >= 1);
        const hotdealFreebies = found?.pro2_amount ? Math.floor(cal * Number(found.pro2_amount)) : 0;
        console.log('- hotdealFreebies:', hotdealFreebies);
        
        if (
          amountInHotdeal > 0 &&
          cal >= 1
        ) {
          match = true;
        }
        return {
          pro_code,
          match,
          countFreeBies: hotdealFreebies.toString(),
          amountInHotdeal
        };
      }
      return undefined;
    } catch (error) {
      console.error('Error checking hotdeal match:', error);
      throw error;
    }
  }

  async getHotdealsByProCodes(proCodes: string[]): Promise<
    {
      id: number;
      product: { pro_code: string } | null;
      pro1_amount: string;
      pro1_unit: string;
      product2: { pro_code: string } | null;
      pro2_amount: string;
      pro2_unit: string;
    }[]
  > {
    if (!proCodes || proCodes.length === 0) return [];
    const hotdeals = await this.hotdealRepo.find({
      where: proCodes.map((code) => ({ product: { pro_code: In([code]) } })),
      relations: ['product', 'product2'],
      order: { id: 'DESC' },
    });
    return hotdeals.map((hd) => ({
      ...hd,
      product: hd.product ? { pro_code: hd.product.pro_code } : null,
      product2: hd.product2,
    }));
  }

  async convertToSmallestUnit(
    pro_code: string,
    spc_amount: string,
    spc_unit: string,
  ): Promise<number | null> {
    const product = await this.productService.getProductOne(pro_code);
    if (!product) {
      console.log(`No product found for pro_code ${pro_code}`);
      return null;
    }
    // สร้าง array ของ unit/ratio
    const units = [
      { unit: product.pro_unit1, ratio: product.pro_ratio1 },
      { unit: product.pro_unit2, ratio: product.pro_ratio2 },
      { unit: product.pro_unit3, ratio: product.pro_ratio3 },
    ];
    // หา unit ที่ตรงกับ spc_unit
    const found = units.find((u) => u.unit === spc_unit);
    if (!found || !found.ratio) {
      console.log(
        `No matching unit found for product ${pro_code} with unit ${spc_unit}`,
      );
      return null;
    }
    return Number(spc_amount) * Number(found.ratio);
  }

  // async saveCartProduct(
  //   body: {
  //     mem_code: string;
  //     pro2_code: string;
  //     pro2_unit: string;
  //     pro2_amount: string;
  //     priceCondition: string;
  //     hotdeal_free: boolean;
  //   }[],
  // ) {
  //   console.log('Saving cart product:', body);
  //   try {
  //     return await Promise.all(
  //       body.map(async (item) => {
  //         try {
  //           return await this.cartService.addProductCartHotDeal({
  //             mem_code: item.mem_code,
  //             pro_code: item.pro2_code,
  //             pro_unit: item.pro2_unit,
  //             amount: Number(item.pro2_amount),
  //             priceCondition: item.priceCondition,
  //             hotdeal_free: true,
  //           });
  //         } catch (err: unknown) {
  //           console.error('Error adding product to cart (HotDeal):', err);
  //           let errorMessage = 'Unknown error';
  //           if (err && typeof err === 'object' && 'message' in err) {
  //             errorMessage =
  //               (err as { message?: string }).message ?? 'Unknown error';
  //           }
  //           return { error: errorMessage, item };
  //         }
  //       }),
  //     );
  //   } catch (error) {
  //     console.error('Error saving cart product:', error);
  //     throw new Error('Error saving cart product');
  //   }
  // }

  async getHotdealFromCode(pro_code: string): Promise<HotdealEntity | null> {
    return this.hotdealRepo.findOne({
      where: { product: { pro_code } },
    });
  }

  async checkProductHotDeal(itemInCart: {
    pro_code: string;
    spc_id: number;
    spc_amount: number;
    spc_unit: string;
  }[]): Promise<{ pro_code: string; status: string; error?: string }[]> {
    try {
      const results: { pro_code: string; status: string; error?: string }[] = [];

      // Loop ผ่าน array ของ itemInCart
      for (const item of itemInCart) {
        console.log('Checking item:', item);

        const productInCart = await this.hotdealRepo.findOne({
          where: { product: { pro_code: item.pro_code } },
          relations: ['product2'],
        });

        if (productInCart) {
          // console.log('productInCart:', productInCart);

          // เช็คเงื่อนไขที่ 1: จำนวนที่สั่ง >= pro1_amount และ unit ตรงกัน
          if (
            Number(item.spc_amount) >= Number(productInCart.pro1_amount) &&
            item.spc_unit === productInCart.pro1_unit
          ) {
            console.log('Condition 1 passed for:', item.pro_code);

            // ตรวจสอบว่ามีข้อมูลของแถม (product2) หรือไม่
            if (!productInCart.product2 || !productInCart.product2.pro_code) {
              results.push({
                pro_code: item.pro_code,
                status: 'Error',
                error: 'สินค้านี้ควรได้รับของแถม แต่ไม่พบข้อมูลของแถมในระบบ'
              });
              continue; // ข้ามไปรายการถัดไป
            }

            // ตรวจสอบว่ามีข้อมูล pro2_amount และ pro2_unit หรือไม่
            if (!productInCart.pro2_amount || !productInCart.pro2_unit) {
              results.push({
                pro_code: item.pro_code,
                status: 'Error',
                error: 'ข้อมูลจำนวนหรือหน่วยของแถมไม่ครบถ้วน'
              });
              continue;
            }

            // เช็คเงื่อนไขที่ 2: จำนวนที่สั่ง === pro2_amount และ unit ตรงกัน
            if (
              Number(item.spc_amount) === Number(productInCart.pro2_amount) &&
              item.spc_unit === productInCart.pro2_unit
            ) {
              console.log('Condition 2 passed for:', item.pro_code);

              // คำนวณจำนวนครั้งที่ได้รับของแถม
              const multiplier = Math.ceil(
                Number(item.spc_amount) / Number(productInCart.pro1_amount),
              );

              if (multiplier === Number(productInCart.pro1_amount)) {
                results.push({
                  pro_code: item.pro_code,
                  status: 'Match'
                });
              } else {
                results.push({
                  pro_code: item.pro_code,
                  status: 'Partial Match'
                });
              }
            } else {
              results.push({
                pro_code: item.pro_code,
                status: 'Eligible but not exact'
              });
            }
          } else {
            results.push({
              pro_code: item.pro_code,
              status: 'Not eligible'
            });
          }
        } else {
          // ไม่มี hotdeal สำหรับสินค้านี้
          results.push({
            pro_code: item.pro_code,
            status: 'No hotdeal'
          });
        }
      }

      return results;
    } catch (error) {
      console.error('Error checking hot deal products:', error);
      throw new Error('Error in checkProductHotDeal');
    }
  }

}

