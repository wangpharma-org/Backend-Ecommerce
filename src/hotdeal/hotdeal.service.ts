/* eslint-disable prettier/prettier */
import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { InjectRepository } from '@nestjs/typeorm';
import { HotdealEntity } from './hotdeal.entity';
import { Repository } from 'typeorm';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';

export interface HotdealInput {
  pro1_code: string;
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
    @Inject(forwardRef(() => ShoppingCartService))
    private readonly shoppingCartService: ShoppingCartService,
  ) { }

  // ตรวจสอบแล้วว่าใช้ได้
  async find(pro_code: string): Promise<HotdealEntity | null> {
    return await this.hotdealRepo.findOne({
      where: { product: { pro_code } },
      relations: ['product', 'product2'],
      select: {
        product: {
          pro_code: true,
        },
        product2: {
          pro_code: true,
        },
      },
    });
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async searchProduct(keyword: string) {
    return this.productService.searchByCodeOrSupplier(keyword);
  }

  // นายเขียนเอง
  async checkAndAddProductToHotdeal(
    pro_code: string,
    unit_hotdeal: string,
    number_amount: number,
    pro_code2: string,
    pro_unit2: string,
  ) {
    try {
      const productHotdeal = await this.productService.getProductOne(pro_code);
      if (!productHotdeal) {
        throw new Error(`Product not found for pro_code: ${pro_code}`);
      }

      const unitRatioMap: Record<string, number> = {};
      if (productHotdeal.pro_unit1)
        unitRatioMap[productHotdeal.pro_unit1] = productHotdeal.pro_ratio1;
      if (productHotdeal.pro_unit2)
        unitRatioMap[productHotdeal.pro_unit2] = productHotdeal.pro_ratio2;
      if (productHotdeal.pro_unit3)
        unitRatioMap[productHotdeal.pro_unit3] = productHotdeal.pro_ratio3;

      const amountSmallestHotdeal =
        number_amount * (unitRatioMap[unit_hotdeal] ?? 1);

      const hotdealProductInCart =
        await this.shoppingCartService.find(pro_code);
      if (!hotdealProductInCart?.length) return;

      const totalsByMember: Record<string, number> = {};

      for (const item of hotdealProductInCart) {
        const ratio = unitRatioMap[item.spc_unit] ?? 1;
        totalsByMember[item.mem_code] =
          (totalsByMember[item.mem_code] ?? 0) + item.spc_amount * ratio;
      }

      for (const [mem_code, totalAmountInCartSmallest] of Object.entries(
        totalsByMember,
      )) {
        const amountFreebies = Math.floor(
          totalAmountInCartSmallest / amountSmallestHotdeal,
        );
        if (amountFreebies > 0) {
          await this.shoppingCartService.addProductCartHotDeal({
            mem_code,
            pro_code: pro_code2,
            pro_unit: pro_unit2,
            amount: amountFreebies,
            hotdeal_free: true,
            hotdeal_promain: pro_code,
          });
        }
      }
    } catch (error) {
      throw new Error(
        'Something Error in checkAndAddProductToHotdeal: ' + error,
      );
    }
  }

  // ตรวจสอบและแก้ไขแล้ว
  async saveHotdeal(datainput: HotdealInput, id?: number, order?: number): Promise<string> {
    try {
      console.log('Hotdeal Input Data:', datainput, id, order);
      if (id) {
        const existingHotdeal = await this.hotdealRepo.findOne({ where: { id: id }, });
        if (existingHotdeal && existingHotdeal.order !== order) {
          const hotdealId = existingHotdeal.id === id;
          if (hotdealId) {
            await this.hotdealRepo.update(
              { id: existingHotdeal.id },
              { order: order },
            );
          }
        }
      } else {
        console.log('Creating new Hotdeal');
        const hotdeal = this.hotdealRepo.create({
          pro1_amount: datainput.pro1_amount,
          pro1_unit: datainput.pro1_unit,
          pro2_amount: datainput.pro2_amount,
          pro2_unit: datainput.pro2_unit,
          product: { pro_code: datainput.pro1_code },
          product2: { pro_code: datainput.pro2_code },
        });

        await this.hotdealRepo.save(hotdeal);
        await this.checkAndAddProductToHotdeal(
          datainput.pro1_code,
          datainput.pro1_unit,
          Number(datainput.pro1_amount),
          datainput.pro2_code,
          datainput.pro2_unit,
        );
      }
      return 'add hotdeal successfully';
    } catch (error) {
      console.error('Error saving hotdeal:', error);
      throw new Error('Something Error in saveHotdeal');
    }
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async getAllHotdealsWithProductNames() {
    const hotdeals = await this.hotdealRepo.find({
      relations: ['product', 'product2'],
      order: { order: 'ASC' },
    });

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
      order: hotdeal.order,
    }));
  }

  // Optimize แล้ว
  async deleteHotdeal(
    id: number,
    pro_code2: string,
  ): Promise<{ message: string }> {
    try {
      await this.shoppingCartService.removeAllCarthotdeal(pro_code2);
      await this.hotdealRepo.delete(id);
      return { message: 'Hotdeal deleted successfully' };
    } catch (error) {
      console.error('Error deleting hotdeal:', error);
      return { message: 'Error deleting hotdeal' };
    }
  }

  // ตรวจสอบแล้วว่าใช้ได้
  async getAllHotdealsWithProductDetail(
    limit?: number,
    offset?: number,
    mem_code?: string,
  ) {
    const query = this.hotdealRepo
      .createQueryBuilder('hotdeal')
      .leftJoinAndSelect('hotdeal.product', 'product')
      .leftJoinAndSelect('hotdeal.product2', 'product2')
      .orderBy('hotdeal.order', 'ASC');

    if (mem_code) {
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
        shopping_cart: mem_code
          ? {
            product_cart: (hotdeal.product as ProductType)?.inCarts || [],
            product2_cart: (hotdeal.product2 as ProductType)?.inCarts || [],
          }
          : 'ไม่เจอข้อมูล',
      };
    });
    return result;
  }

  // ตรวจสอบแล้วคิดว่าใช้งานได้
  async checkHotdealMatch(
    pro_code: string,
    shopping_cart: { pro1_unit: string; pro1_amount: string }[],
  ): Promise<
    | {
      pro_code: string;
      match: boolean;
      countFreeBies: string;
      product2: { pro_code: string; pro_name: string };
      hotdeal: {
        pro1_amount: string;
        pro1_unit: string;
        pro2_amount: string;
        pro2_unit: string;
      };
    }
    | undefined
  > {
    console.log('Cart items:', shopping_cart, pro_code);
    try {
      const found = await this.hotdealRepo.findOne({
        where: { product: { pro_code } },
        relations: ['product', 'product2'],
      });

      console.log('Found hotdeal:', found);

      let fromFrontend = 0;
      for (let i = 0; i < shopping_cart.length; i++) {
        const convertedFrontend = await this.convertToSmallestUnit(
          pro_code,
          shopping_cart[i].pro1_amount,
          shopping_cart[i].pro1_unit,
        );
        fromFrontend += convertedFrontend ?? 0;
      }

      console.log('Total amount from frontend in smallest unit:', fromFrontend, pro_code);
      console.log('=======================================')

      console.log("before call convertToSmallestUnit From Database", pro_code, found?.pro1_amount, found?.pro1_unit);
      const fromDatabase = await this.convertToSmallestUnit(
        pro_code,
        found?.pro1_amount ?? '',
        found?.pro1_unit ?? '',
      );
      console.log('Converted amount from database in smallest unit:', fromDatabase);

      let match = false;
      if (found) {
        console.log('Found hotdeal:', found);
        const amountInCart = fromFrontend ?? 0;
        console.log('Amount in cart (smallest unit):', amountInCart);
        const cal = Math.floor(amountInCart / (fromDatabase ?? 0));
        console.log('Calculation result (cal):', cal);

        const hotdealFreebies = found?.pro2_amount
          ? Math.floor(cal * Number(found.pro2_amount))
          : 0;

        if ((fromDatabase ?? 0) > 0 && cal >= 1) {
          match = true;
        }
        console.log('Hotdeal freebies count:', hotdealFreebies);
        console.log('Match status:', match);

        return {
          pro_code,
          match,
          countFreeBies: hotdealFreebies.toString(),
          product2: {
            pro_code: found.product2?.pro_code || '',
            pro_name: found.product2?.pro_name || '',
          },
          hotdeal: {
            pro1_amount: found.pro1_amount,
            pro1_unit: found.pro1_unit,
            pro2_amount: found.pro2_amount,
            pro2_unit: found.pro2_unit,
          },
        };
      }

      return undefined;
    } catch (error) {
      console.error('Error checking hotdeal match:', error);
      throw error;
    }
  }

  // ตรวจสอบแล้วว่าใช้งานได้
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

    const units = [
      { unit: product.pro_unit1, ratio: product.pro_ratio1 },
      { unit: product.pro_unit2, ratio: product.pro_ratio2 },
      { unit: product.pro_unit3, ratio: product.pro_ratio3 },
    ];

    const found = units.find((u) => u.unit === spc_unit);
    if (!found || !found.ratio) {
      console.log(
        `No matching unit found for product ${pro_code} with unit ${spc_unit}`,
      );
      return null;
    }
    return Number(spc_amount) * Number(found.ratio);
  }

  // ตรวจสอบแล้วว่าใช้งานได้
  async getHotdealFromCode(pro_code: string): Promise<HotdealEntity | null> {
    return this.hotdealRepo.findOne({
      where: { product: { pro_code } },
    });
  }

  async findAllHotdeals(): Promise<HotdealEntity[]> {
    return await this.hotdealRepo.find({
      relations: ['product', 'product2'],
      select: {
        pro1_amount: true,
        pro1_unit: true,
        pro2_amount: true,
        pro2_unit: true,
        product: {
          pro_code: true,
        },
        product2: {
          pro_code: true,
        },
      },
    });
  }
}
