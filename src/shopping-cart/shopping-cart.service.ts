import { Injectable } from '@nestjs/common';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { PromotionEntity } from 'src/promotion/promotion.entity';
export interface ShoppingProductCart {
  pro_code: string;
  pro_name: string;
  pro_imgmain: string;
  pro_priceA: string;
  pro_priceB: string;
  pro_priceC: string;
  pro_unit1: string;
  pro_unit2: string;
  pro_unit3: string;
  pro_ratio1: number;
  pro_ratio2: number;
  pro_ratio3: number;
  pro_promotion_month: number;
  pro_promotion_amount: number;
  shopping_cart: ShoppingCart[];
}

export interface ShoppingCart {
  spc_id: number;
  spc_amount: string;
  spc_checked: number;
  spc_unit: string;
  pro_promotion_month: number;
  pro_promotion_amount: number;
  is_reward: boolean;
}

interface RawProductCart {
  pro_code: string;
  pro_name: string;
  pro_imgmain: string;
  pro_priceA: string;
  pro_priceB: string;
  pro_priceC: string;
  pro_unit1: string;
  pro_unit2: string;
  pro_unit3: string;
  pro_ratio1: number;
  pro_ratio2: number;
  pro_ratio3: number;
  pro_promotion_month: number;
  pro_promotion_amount: number;
  spc_id: number;
  spc_amount: string;
  spc_unit: string;
  spc_checked: number;
  is_reward: boolean | number;
}

// Define a DTO for the return type
export interface CartSummary {
  cart: any[];
  sum_order: {
    sum_price: number;
    discount: number;
    shipping_price: number;
    total: number;
    coin: number;
  };
  member: any;
  payment_type: any;
  shipping_type: any;
}

@Injectable()
export class ShoppingCartService {
  constructor(
    @InjectRepository(ShoppingCartEntity)
    private readonly shoppingCartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    private readonly productsService: ProductsService,
  ) { }

  async addProductCart(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
    priceCondition: string;
    is_reward: boolean;
  }): Promise<ShoppingProductCart[]> {
    try {
      // 1) หาสินค้าในตะกร้า
      const existing = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit: data.pro_unit,
        },
      });

      // 2) เพิ่ม/แก้ไข/ลบ สินค้าใน cart
      if (existing) {
        const newAmount = Number(existing.spc_amount) + data.amount;
        if (newAmount > 0) {
          await this.shoppingCartRepo.update(
            { spc_id: existing.spc_id },
            { spc_amount: newAmount, spc_datetime: new Date() },
          );
        } else {
          await this.shoppingCartRepo.delete({ spc_id: existing.spc_id });
        }
      } else {
        await this.shoppingCartRepo.save({
          pro_code: data.pro_code,
          mem_code: data.mem_code,
          spc_unit: data.pro_unit,
          spc_amount: data.amount,
          spc_price: 0, // ถ้าต้องมีราคา default
          is_reward: false, // สินค้าปกติ
          spc_datetime: new Date(),
        });
      }

      // 3) ตรวจสอบโปรโมชั่น + เพิ่มของแถม (ราคาศูนย์)
      await this.checkPromotionReward(data.mem_code, data.priceCondition);

      // 4) คืนตะกร้าล่าสุด
      return await this.getProductCart(data.mem_code);
    } catch (error) {
      console.error('Error saving product cart:', error);
      throw new Error('Error in Add product Cart');
    }
  }
  async addProductCartHotDeal(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
    priceCondition: string;
    is_reward: boolean;
  }): Promise<ShoppingProductCart[]> {
    try {
      await this.shoppingCartRepo.save({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        spc_unit: data.pro_unit,
        spc_amount: data.amount,
        spc_price: 0, // ถ้าต้องมีราคา default
        is_reward: true, // สินค้าปกติ
        spc_datetime: new Date(),
      });
      return await this.getProductCart(data.mem_code);
    } catch (error) {
      console.error('Error saving product cart:', error);
      throw new Error('Error in Add product Cart');
    }
  }

  async checkPromotionReward(mem_code: string, priceOption: string) {
    // โหลด cart พร้อม product
    const cart = await this.shoppingCartRepo.find({
      where: { mem_code },
      relations: { product: true },
    });

    const numberOfMonth = new Date().getMonth() + 1;

    // ✅ กรองเฉพาะที่ spc_checked === true
    const checkedCart = cart.filter((item) => item.spc_checked);

    // 1) คำนวณยอดรวม
    const totalSumPrice = checkedCart.reduce((sum, item) => {
      if (!item.product) return sum;

      const ratioMap = new Map([
        [item.product.pro_unit1, item.product.pro_ratio1],
        [item.product.pro_unit2, item.product.pro_ratio2],
        [item.product.pro_unit3, item.product.pro_ratio3],
      ]);
      const ratio = ratioMap.get(item.spc_unit) ?? 1;

      const totalAmount = checkedCart
        .filter((c) => c.pro_code === item.pro_code)
        .reduce(
          (s, sc) =>
            s + Number(sc.spc_amount) * (ratioMap.get(sc.spc_unit) ?? 0),
          0,
        );

      const isPromo =
        item.product.pro_promotion_month === numberOfMonth &&
        totalAmount >= (item.product.pro_promotion_amount ?? 0);

      const unitPrice =
        priceOption === 'A'
          ? Number(item.product.pro_priceA)
          : priceOption === 'B'
            ? Number(item.product.pro_priceB)
            : priceOption === 'C'
              ? Number(item.product.pro_priceC)
              : 0;

      const price = isPromo
        ? Number(item.spc_amount) * Number(item.product.pro_priceA) * ratio
        : Number(item.spc_amount) * unitPrice * ratio;

      return sum + price;
    }, 0);

    // 2) โหลด promotions
    const promotions = await this.promotionRepo.find({
      where: { status: true },
      relations: { tiers: { rewards: { giftProduct: true } } },
    });

    // 3) คำนวณ reward ที่ควรมี
    const shouldHave: Array<{ pro_code: string; unit: string; qty: number }> =
      [];

    for (const promo of promotions) {
      const tiers = [...promo.tiers].sort(
        (a, b) => a.min_amount - b.min_amount,
      );
      const passed = tiers.filter((t) => totalSumPrice >= t.min_amount);
      if (!passed.length) continue;

      const rewardTiers =
        totalSumPrice >= tiers[tiers.length - 1].min_amount
          ? passed
          : [passed[passed.length - 1]];

      for (const tier of rewardTiers) {
        const multiplier = Math.floor(totalSumPrice / tier.min_amount);
        for (const rw of tier.rewards) {
          if (!rw.giftProduct?.pro_code) continue;
          shouldHave.push({
            pro_code: rw.giftProduct.pro_code,
            unit: rw.unit,
            qty: rw.qty * multiplier,
          });
        }
      }
    }

    // 4) sync reward ใน cart
    const rewardInCart = cart.filter((c) => c.is_reward);

    // ลบ reward ที่ไม่ควรมี
    const toRemove = rewardInCart.filter(
      (r) =>
        !shouldHave.some(
          (s) => s.pro_code === r.pro_code && s.unit === r.spc_unit,
        ),
    );
    if (toRemove.length) {
      await this.shoppingCartRepo.remove(toRemove);
    }

    // เพิ่ม/อัปเดต reward
    for (const s of shouldHave) {
      const found = rewardInCart.find(
        (r) => r.pro_code === s.pro_code && r.spc_unit === s.unit,
      );

      if (!found) {
        await this.shoppingCartRepo.save({
          pro_code: s.pro_code,
          mem_code,
          spc_unit: s.unit,
          spc_amount: s.qty,
          spc_price: 0,
          is_reward: true,
          spc_datetime: new Date(),
        });
      } else if (found.spc_amount !== s.qty) {
        await this.shoppingCartRepo.update(
          { spc_id: found.spc_id },
          { spc_amount: s.qty, spc_datetime: new Date() },
        );
      }
    }
  }

  async checkedProductCart(data: {
    pro_code: string;
    mem_code: string;
    type: string;
    priceOption: string;
  }): Promise<ShoppingProductCart[]> {
    try {
      if (data.type === 'check') {
        await this.shoppingCartRepo.update(
          { pro_code: data.pro_code, mem_code: data.mem_code },
          { spc_checked: true },
        );
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          { pro_code: data.pro_code, mem_code: data.mem_code },
          { spc_checked: false },
        );
      } else {
        throw new Error('Something wrong in checkedProductCart');
      }

      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');

      return await this.getProductCart(data.mem_code);
    } catch (e) {
      console.error('Error in checkedProductCart', e);
      throw new Error('Something wrong in checkedProductCart');
    }
  }

  async handleGetCartToOrder(
    mem_code: string,
  ): Promise<ShoppingCartEntity[] | undefined> {
    try {
      return await this.shoppingCartRepo.find({
        where: {
          mem_code: mem_code,
          spc_checked: true,
        },
        relations: ['product'],
      });
    } catch {
      throw new Error('Somthing wrong in handleGetCartToOrder');
    }
  }

  async handleDeleteCart(data: {
    pro_code: string;
    mem_code: string;
    priceOption: string;
  }): Promise<ShoppingProductCart[]> {
    try {
      await this.shoppingCartRepo.delete({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
      });
      console.log('priceOption', data.priceOption);
      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');
      return await this.getProductCart(data.mem_code);
    } catch {
      throw new Error('Somthing wrong in delete product cart');
    }
  }

  async clearCheckoutCart(spc_id: number) {
    try {
      await this.shoppingCartRepo.delete(spc_id);
    } catch {
      throw new Error('Clear Checkout Cart Failed');
    }
  }

  async checkedProductCartAll(data: {
    mem_code: string;
    type: string;
    priceOption: string;
  }): Promise<ShoppingProductCart[]> {
    try {
      if (data.type === 'check') {
        await this.shoppingCartRepo.update(
          { mem_code: data.mem_code },
          { spc_checked: true },
        );
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          { mem_code: data.mem_code },
          { spc_checked: false },
        );
      } else {
        throw new Error('Somthing wrong in checkedProductCartAll');
      }

      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');

      return await this.getProductCart(data.mem_code);
    } catch (e) {
      console.error('Error in checkedProductCartAll', e);
      throw new Error('Somthing wrong in checkedProductCartAll');
    }
  }

  async getCartItemCount(mem_code: string): Promise<number> {
    try {
      const result = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .where('cart.mem_code = :mem_code', { mem_code })
        .select('COUNT(DISTINCT cart.pro_code)', 'total')
        .getRawOne<{ total: string }>();

      if (result) {
        return parseInt(result.total, 10);
      } else {
        return 0;
      }
    } catch (error) {
      console.error('Error getting cart item count:', error);
      throw new Error('Error in getCartItemCount');
    }
  }

  async getProductCart(mem_code: string): Promise<ShoppingProductCart[]> {
    try {
      const raw: RawProductCart[] = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .leftJoinAndSelect('cart.product', 'product')
        .where('cart.mem_code = :mem_code', { mem_code })
        .select([
          'product.pro_code AS pro_code',
          'product.pro_name AS pro_name',
          'product.pro_imgmain AS pro_imgmain',
          'product.pro_priceA AS pro_priceA',
          'product.pro_priceB AS pro_priceB',
          'product.pro_priceC AS pro_priceC',
          'product.pro_unit1 AS pro_unit1',
          'product.pro_unit2 AS pro_unit2',
          'product.pro_unit3 AS pro_unit3',
          'product.pro_ratio1 AS pro_ratio1',
          'product.pro_ratio2 AS pro_ratio2',
          'product.pro_ratio3 AS pro_ratio3',
          'product.pro_promotion_month AS pro_promotion_month',
          'product.pro_promotion_amount AS pro_promotion_amount',
          'cart.spc_id AS spc_id',
          'cart.spc_amount AS spc_amount',
          'cart.spc_unit AS spc_unit',
          'cart.spc_checked AS spc_checked',
          'cart.is_reward AS is_reward',
        ])
        .orderBy('product.pro_code', 'ASC')
        .getRawMany<RawProductCart>();

      const grouped: Record<string, ShoppingProductCart> = {};

      for (const row of raw) {
        const code = row.pro_code;

        if (!grouped[code]) {
          grouped[code] = {
            pro_code: row.pro_code,
            pro_name: row.pro_name,
            pro_imgmain: row.pro_imgmain,
            pro_priceA: row.pro_priceA,
            pro_priceB: row.pro_priceB,
            pro_priceC: row.pro_priceC,
            pro_unit1: row.pro_unit1,
            pro_unit2: row.pro_unit2,
            pro_unit3: row.pro_unit3,
            pro_ratio1: row.pro_ratio1,
            pro_ratio2: row.pro_ratio2,
            pro_ratio3: row.pro_ratio3,
            pro_promotion_month: row.pro_promotion_month,
            pro_promotion_amount: row.pro_promotion_amount,
            shopping_cart: [],
          };
        }
        grouped[code].shopping_cart.push({
          spc_id: row.spc_id,
          spc_amount: row.spc_amount,
          spc_checked: row.spc_checked,
          spc_unit: row.spc_unit,
          is_reward: !!row.is_reward,
          pro_promotion_month: row.pro_promotion_month,
          pro_promotion_amount: row.pro_promotion_amount,
        });
      }

      const totalSmallestUnit = await Promise.all(
        Object.values(grouped).map(async (group) => {
          // กรอง orderItems ตาม pro_code
          const orderItems = group.shopping_cart.map((item) => ({
            unit: item.spc_unit,
            quantity: parseFloat(item.spc_amount), // แปลงจำนวนเป็นตัวเลข
            pro_code: group.pro_code, // เพิ่ม pro_code ใน orderItems
          }));

          console.log('orderItems:', orderItems);

          // คำนวณหน่วยที่เล็กที่สุดสำหรับ pro_code นี้
          return this.productsService.calculateSmallestUnit(orderItems);
        }),
      );
      console.log('totalSmallestUnit:', totalSmallestUnit);

      const ProductMaptotalSmallestUnit = totalSmallestUnit.map(
        (total, index) => ({
          pro_code: Object.values(grouped)[index].pro_code,
          totalSmallestUnit: total,
        }),
      );

      const result: ShoppingProductCart[] = Object.values(grouped).map(
        (group) => {
          const productTotal = ProductMaptotalSmallestUnit.find(
            (item) => item.pro_code === group.pro_code,
          );

          return {
            ...group,
            totalSmallestUnit: productTotal
              ? productTotal.totalSmallestUnit
              : 0,
          };
        },
      );

      return result;
    } catch (error) {
      console.error('Error get product cart:', error);
      throw new Error(`Error in Get product Cart`);
    }
  }

  async clearFreebieCart(mem_code: string, pro2_code: string): Promise<void> {
    try {
      console.log('Clearing freebie cart items for mem_code:', mem_code);
      await this.shoppingCartRepo.delete({
        mem_code: mem_code,
        pro_code: pro2_code,
      });
    } catch (error) {
      console.error('Error clearing freebie cart items:', error);
      throw new Error('Error in clearFreebieCart');
    }
  }

  async getProFreebie(memCode: string): Promise<{ spc_id: number, spc_amount: number, spc_unit: string, is_reward: boolean, pro_code: string }[]> {
    try {
      console.log('Fetching freebie products for mem_code:', memCode);
      const freebies = await this.shoppingCartRepo.find({
        where: {
          mem_code: memCode,
          is_reward: true,
        },
      });
      return freebies;
    } catch (error) {
      console.error('Error fetching freebie products:', error);
      throw new Error('Error in getProFreebie');
    }
  }
}
