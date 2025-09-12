import { Injectable } from '@nestjs/common';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { console } from 'inspector';
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
    private readonly productsService: ProductsService,
  ) { }

  async addProductCart(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
    pro_freebie: number;
  }): Promise<ShoppingProductCart[]> {
    try {
      const existing = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit: data.pro_unit,
        },
      });
      if (existing && Number(existing.spc_amount) + data.amount > 0) {
        const spc_amount = Number(existing.spc_amount) + data.amount;
        await this.shoppingCartRepo.update(
          { spc_id: existing.spc_id },
          {
            spc_amount: spc_amount,
            spc_datetime: Date(),
          },
        );
        return await this.getProductCart(data.mem_code);
      } else if (existing && Number(existing.spc_amount) + data.amount <= 0) {
        await this.shoppingCartRepo.delete({ spc_id: existing.spc_id });
        return await this.getProductCart(data.mem_code);
      } else {
        const updateData = {
          pro_code: data.pro_code,
          mem_code: data.mem_code,
          spc_unit: data.pro_unit,
          spc_amount: data.amount,
          spc_datetime: Date(),
          pro_freebie: data.pro_freebie || 0,
        };
        await this.shoppingCartRepo.save(updateData);
        return await this.getProductCart(data.mem_code);
      }
    } catch (error) {
      console.error('Error saving product cart:', error);
      throw new Error(`Error in Add product Cart`);
    }
  }

  async checkedProductCart(data: {
    pro_code: string;
    mem_code: string;
    type: string;
  }): Promise<ShoppingProductCart[]> {
    try {
      if (data.type === 'check') {
        await this.shoppingCartRepo.update(
          {
            pro_code: data.pro_code,
            mem_code: data.mem_code,
          },
          {
            spc_checked: true,
          },
        );
        return await this.getProductCart(data.mem_code);
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          {
            pro_code: data.pro_code,
            mem_code: data.mem_code,
          },
          {
            spc_checked: false,
          },
        );
        return await this.getProductCart(data.mem_code);
      } else {
        throw new Error('Somthing wrong in checkedProductCart');
      }
    } catch {
      throw new Error('Somthing wrong in checkedProductCart');
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
  }): Promise<ShoppingProductCart[]> {
    try {
      await this.shoppingCartRepo.delete({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
      });
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
  }): Promise<ShoppingProductCart[]> {
    try {
      if (data.type === 'check') {
        await this.shoppingCartRepo.update(
          {
            mem_code: data.mem_code,
          },
          {
            spc_checked: true,
          },
        );
        return await this.getProductCart(data.mem_code);
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          {
            mem_code: data.mem_code,
          },
          {
            spc_checked: false,
          },
        );
        return await this.getProductCart(data.mem_code);
      } else {
        throw new Error('Somthing wrong in checkedProductCartAll');
      }
    } catch {
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

  async clearFreebieCart(mem_code: string): Promise<void> {
    try {
      console.log('Clearing freebie cart items for mem_code:', mem_code);
      await this.shoppingCartRepo.delete({
        mem_code: mem_code,
        pro_freebie: 1,
      });
    } catch (error) {
      console.error('Error clearing freebie cart items:', error);
      throw new Error('Error in clearFreebieCart');
    }
  }

  async getProFreebie(memCode: string): Promise<{spc_id: number, spc_amount: number, spc_unit: string, pro_freebie: number}[]> {
    try {
      console.log('Fetching freebie products for mem_code:', memCode);
      const freebies = await this.shoppingCartRepo.find({
        where: {
          mem_code: memCode,
          pro_freebie: 1,
        },
      });
      return freebies;
    } catch (error) {
      console.error('Error fetching freebie products:', error);
      throw new Error('Error in getProFreebie');
    }
  }
}
