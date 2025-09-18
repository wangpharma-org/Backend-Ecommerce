import { Injectable } from '@nestjs/common';
import { ProductsService } from '../products/products.service';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { HotdealEntity } from './hotdeal.entity';
import { In, Repository } from 'typeorm';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
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
      private readonly cartService: ShoppingCartService
  ) {}
  // addProductCart
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
          order: { id: 'DESC' }
      });
      // map เฉพาะชื่อสินค้าออกมา
      return hotdeals.map(hotdeal => ({
          id: hotdeal.id,
          pro_code: hotdeal.product?.pro_code || null,
          pro2_code: hotdeal.product2?.pro_code || null,
          pro1_amount: hotdeal.pro1_amount,
          pro1_unit: hotdeal.pro1_unit,
          pro2_amount: hotdeal.pro2_amount,
          pro2_unit: hotdeal.pro2_unit,
          pro_name: hotdeal.product?.pro_name || null,
          pro2_name: hotdeal.product2?.pro_name || null
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

  async getAllHotdealsWithProductDetail(limit?: number, offset?: number) {
      const hotdeals = await this.hotdealRepo.find({
          order: { id: 'DESC' },
          relations: ['product', 'product2'],
          take: limit,
          skip: offset
      });
      const result = await Promise.all(hotdeals.map(async (hotdeal) => {
          const product = hotdeal.product ? await this.productService.getProductOne(hotdeal.product.pro_code) : null;
          const product2 = hotdeal.product2 ? await this.productService.getProductOne(hotdeal.product2.pro_code) : null;
          const pickFields = (p: any) => p ? {
              pro_code: p.pro_code,
              pro_name: p.pro_name,
              pro_priceA: p.pro_priceA,
              pro_priceB: p.pro_priceB,
              pro_priceC: p.pro_priceC,
              pro_imgmain: p.pro_imgmain,
              pro_ratio1: p.pro_ratio1,
              pro_ratio2: p.pro_ratio2,
              pro_ratio3: p.pro_ratio3,
              pro_unit1: p.pro_unit1,
              pro_unit2: p.pro_unit2,
              pro_unit3: p.pro_unit3
          } : null;
          return {
              id: hotdeal.id,
              pro1_amount: hotdeal.pro1_amount,
              pro1_unit: hotdeal.pro1_unit,
              pro2_amount: hotdeal.pro2_amount,
              pro2_unit: hotdeal.pro2_unit,
              product: pickFields(product),
              product2: pickFields(product2)
          };
      }));
      return result;
  }

  async checkHotdealMatch(mem_code: string, pro_code: string, shopping_cart: { pro1_unit: string, pro1_amount: string }): Promise<{ pro_code: string, match: boolean, countFreeBies: String } | undefined> {
      try {
          const found = await this.hotdealRepo.findOne({
              where: { product: { pro_code } },
              relations: ['product']
          });
          const fromFrontend = await this.convertToSmallestUnit(pro_code, shopping_cart.pro1_amount, shopping_cart.pro1_unit);
          const fromDatabase = await this.convertToSmallestUnit(pro_code, found?.pro1_amount ?? '', found?.pro1_unit ?? '');
          let match = false;
          if (found) {
              const amountInCart = fromFrontend ?? 0;
              const amountInHotdeal = fromDatabase ?? 0;
              if (amountInHotdeal > 0 && Math.floor(amountInCart / amountInHotdeal) >= 1) {
                  match = true;
              }
              return { pro_code, match, countFreeBies: Math.floor(amountInCart / amountInHotdeal).toString() };
          }
          return undefined;
      } catch (error) {
          console.error('Error checking hotdeal match:', error);
          throw error;
      }
  }

  async getHotdealsByProCodes(proCodes: string[]): Promise<{ id: number, product: { pro_code: string } | null, pro1_amount: string, pro1_unit: string, product2: { pro_code: string } | null, pro2_amount: string, pro2_unit: string }[]> {
      if (!proCodes || proCodes.length === 0) return [];
      const hotdeals = await this.hotdealRepo.find({
          where: proCodes.map(code => ({ product: { pro_code: In([code]) } })),
          relations: ['product', 'product2'],
          order: { id: 'DESC' }
      });
      return hotdeals.map(hd => ({
          ...hd,
          product: hd.product ? { pro_code: hd.product.pro_code } : null,
          product2: hd.product2,
      }));
  }

  async convertToSmallestUnit(pro_code: string, spc_amount: string, spc_unit: string): Promise<number | null> {
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
      const found = units.find(u => u.unit === spc_unit);
      if (!found || !found.ratio) {
          console.log(`No matching unit found for product ${pro_code} with unit ${spc_unit}`);
          return null;
      }
      return Number(spc_amount) * Number(found.ratio);
  }

  async saveCartProduct(body: { mem_code: string, pro2_code: string, pro2_unit: string, pro2_amount: string, priceCondition: string, is_reward: boolean }[]) {
      console.log('Saving cart product:', body);
      try {
          return await Promise.all(
              body.map(item =>
                  this.cartService.addProductCartHotDeal({
                      mem_code: item.mem_code,
                      pro_code: item.pro2_code,
                      pro_unit: item.pro2_unit,
                      amount: Number(item.pro2_amount),
                      priceCondition: item.priceCondition,
                      is_reward: item.is_reward ?? true,
                  })
              )
          );
      } catch (error) {
          console.error('Error saving cart product:', error);
          throw new Error('Error saving cart product');
      }
  }

  async getHotdealFromCode(pro_code: string): Promise<HotdealEntity | null> {
      const codeHotdeal = await this.hotdealRepo.findOne({
          where: { product: { pro_code } },
          relations: ['product']
      });
      return codeHotdeal ? { ...codeHotdeal, product: codeHotdeal.product || null } : null;
  }
}