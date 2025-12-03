import { ConflictException, forwardRef, Inject, Injectable } from '@nestjs/common';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, Not, Brackets } from 'typeorm';
import { ProductsService } from '../products/products.service';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { HotdealService } from 'src/hotdeal/hotdeal.service';
import { UserEntity } from 'src/users/users.entity';
import { ProductEntity } from 'src/products/products.entity';
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
  lots: LotItem[];
  recommend: RecommendedProduct[];
  flashsale_limit?: number;
  flashsale_time_end?: string;
  flashsale_time_start?: string;
  flashsale_date?: string;
  pro_stock: number;
  order_quantity: number;
  pro_lowest_stock: number;
  recommended_id?: number;
  recommend_rank?: number;
  is_reward: boolean;
}

export interface RecommendedProduct {
  recommended_id: number | null;
  pro_code: string;
  pro_imgmain: string;
  pro_name: string;
  recommend_rank?: number | null;
}

export interface LotItem {
  lot_id: number;
  lot: string;
  mfg: string;
  exp: string;
}

export interface ShoppingCart {
  spc_id: number;
  spc_amount: string;
  spc_checked: number;
  spc_unit: string;
  pro_promotion_month: number;
  pro_promotion_amount: number;
  is_reward: boolean;
  flashsale_end?: string;
  hotdeal_free: boolean;
  pro_code: string;
}

export interface FlashSale {
  promotion_id: number;
  limit: number;
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
  lot_id: number;
  lot: string;
  mfg: string;
  exp: string;
  lot_pro_code: string;
  spc_id: number;
  spc_amount: string;
  spc_unit: string;
  spc_checked: number;
  is_reward: boolean | number;
  flashsale_end?: string;
  flashsale_limit?: number;
  flashsale_time_end?: string;
  flashsale_time_start?: string;
  flashsale_date?: string;
  hotdeal_free: boolean;
  recommended_id: number;
  recommended_pro_imgmain?: string;
  recommended_pro_name?: string;
  recommended_pro_code?: string;
  pro_stock: number;
  order_quantity: number;
  pro_lowest_stock: number;
  recommend_rank?: number;
  replace_pro_code?: string;
  replace_pro_name?: string;
  replace_pro_imgmain?: string;
  recommended_replace_pro_code?: string;
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

export interface CartVersionState {
  cartVersion: string;
  cartSyncedAt: Date | null;
}

export interface CartMutationResult extends CartVersionState {
  cart: ShoppingProductCart[];
}

@Injectable()
export class ShoppingCartService {
  constructor(
    @InjectRepository(ShoppingCartEntity)
    private readonly shoppingCartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly tierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly conRepo: Repository<PromotionConditionEntity>,
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => HotdealService))
    private readonly hotdealService: HotdealService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  private normalizeCartVersion(
    value?: string | number | null,
  ): string {
    if (value === null || value === undefined) {
      return '0';
    }
    return typeof value === 'string' ? value : String(value);
  }

  private toBigInt(value: string | number): bigint {
    try {
      return typeof value === 'string' ? BigInt(value) : BigInt(value);
    } catch {
      throw new ConflictException('Invalid cart version value.');
    }
  }

  private async ensureCartVersionFresh(
    mem_code: string,
    clientVersion?: string | number,
  ): Promise<void> {
    if (clientVersion === undefined || clientVersion === null) {
      return;
    }
    const { cartVersion } = await this.getCartVersionState(mem_code);
    if (this.toBigInt(cartVersion) !== this.toBigInt(clientVersion)) {
      throw new ConflictException(
        'Cart data is outdated. Please refresh and try again.',
      );
    }
  }

  private async incrementCartVersion(
    mem_code: string,
  ): Promise<CartVersionState> {
    const result = await this.userRepo
      .createQueryBuilder()
      .update(UserEntity)
      .set({
        cart_version: () => 'cart_version + 1',
        cart_synced_at: () => 'CURRENT_TIMESTAMP',
      })
      .where('mem_code = :mem_code', { mem_code })
      .execute();

    if (!result.affected) {
      throw new Error(`Member ${mem_code} not found`);
    }

    return this.getCartVersionState(mem_code);
  }

  async getCartVersionState(mem_code: string): Promise<CartVersionState> {
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: {
        cart_version: true,
        cart_synced_at: true,
      },
    });

    if (!member) {
      throw new Error(`Member ${mem_code} not found`);
    }

    return {
      cartVersion: this.normalizeCartVersion(member.cart_version),
      cartSyncedAt: member.cart_synced_at ?? null,
    };
  }

  async markCartAsChanged(mem_code: string): Promise<CartVersionState> {
    return this.incrementCartVersion(mem_code);
  }

  async getCartSnapshot(mem_code: string): Promise<CartMutationResult> {
    const [cart, version] = await Promise.all([
      this.getProductCart(mem_code),
      this.getCartVersionState(mem_code),
    ]);
    return {
      cart,
      ...version,
    };
  }

  private async handleCheckFlashsale(pro_code: string) {
    const data = await this.productRepo.findOne({
      where: { pro_code },
      relations: { flashsale: { flashsale: true }},
    });
    console.log('Flashsale data:', data);
    if (!data || !data.flashsale || data.flashsale[0]?.flashsale.is_active === false) {
      await this.shoppingCartRepo.update({ pro_code }, { flashsale_end: null });
      throw new Error('No flashsale data found');
    }
  }

  async addProductCart(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
    priceCondition: string;
    flashsale_end?: string;
    clientVersion?: string | number;
  }): Promise<CartMutationResult> {
    try {
      if (data.flashsale_end) {
        await this.handleCheckFlashsale(data.pro_code);
      }
      
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      const existing = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit: data.pro_unit,
          hotdeal_free: false,
          is_reward: false,
        },
      });

      console.log('Existing cart item:', data.flashsale_end);

      if (existing) {
        const newAmount = Number(existing.spc_amount) + data.amount;
        if (newAmount > 0) {
          console.log('if', data.flashsale_end);
          await this.shoppingCartRepo.update(
            { spc_id: existing.spc_id },
            {
              spc_amount: newAmount,
              spc_datetime: new Date(),
              flashsale_end: data.flashsale_end ?? undefined,
            },
          );
        } else {
          const hotdeal = await this.hotdealService.find(data.pro_code);
          await this.shoppingCartRepo.delete({ spc_id: existing.spc_id });

          if (hotdeal && hotdeal.product2?.pro_code) {
            await this.shoppingCartRepo.delete({
              mem_code: data.mem_code,
              pro_code: hotdeal.product2.pro_code,
              hotdeal_free: true,
            });
            console.log(
              'Removed hotdeal freebie for pro_code:',
              hotdeal.product2.pro_code,
            );
          }
        }
      } else {
        await this.shoppingCartRepo.save({
          pro_code: data.pro_code,
          mem_code: data.mem_code,
          spc_unit: data.pro_unit,
          spc_amount: data.amount,
          spc_price: 0,
          is_reward: false,
          spc_datetime: new Date(),
          flashsale_end: data.flashsale_end ?? undefined,
          spc_comments: '',
          hotdeal_free: false,
        });
      }

      console.log('Check Promotion');
      await this.checkPromotionReward(data.mem_code, data.priceCondition);

      console.log('Check Hotdeal');
      await this.checkHotdealByProCode(data.mem_code, data.pro_code);

      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      return { cart, ...version };
    } catch (error) {
      console.error('Error saving product cart:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Error in Add product Cart');
    }
  }

  async addProductCartHotDeal(
    data: {
      mem_code: string;
      pro_code: string;
      pro_unit: string;
      amount: number;
      hotdeal_free: boolean;
      hotdeal_promain: string;
      clientVersion?: string | number;
    },
    options?: { touchVersion?: boolean },
  ): Promise<CartMutationResult> {
    const touchVersion = options?.touchVersion ?? true;
    try {
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      console.log('Add Hotdeal Free Item:', data);
      await this.shoppingCartRepo.save({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        spc_unit: data.pro_unit,
        spc_amount: data.amount,
        spc_price: 0,
        hotdeal_free: true,
        hotdeal_promain: data.hotdeal_promain,
        spc_datetime: new Date(),
      });
      console.log('Check Promotion for Hotdeal');
      const cart = await this.getProductCart(data.mem_code);
      const version = touchVersion
        ? await this.incrementCartVersion(data.mem_code)
        : await this.getCartVersionState(data.mem_code);
      return { cart, ...version };
    } catch (error) {
      console.error('Error saving product cart:', error);
      if (error instanceof ConflictException) {
        throw error;
      }
      throw new Error('Error in Add product Cart');
    }
  }

  async checkPromotionReward(mem_code: string, priceOption: string) {
    console.log('Checking promotion rewards for member:', mem_code);
    const today = new Date();

    // 1) ดึงรายการทั้งหมดใน Cart
    const cart = await this.shoppingCartRepo.find({
      where: { mem_code },
      relations: { product: true },
    });

    // 2) ฟิลเตอร์เฉพาะ reward ที่หมดอายุ แล้วใช้ code ต่ออายุ
    const rewardUseCodeItems = cart.filter(
      (c) => c.is_reward && c.spc_checked && c.use_code === true,
    );

    if (rewardUseCodeItems.length > 0) {
      const distinctTierIds = Array.from(
        new Set(
          rewardUseCodeItems
            .filter((r) => r.tier_id !== undefined && r.tier_id !== null)
            .map((r) => r.tier_id),
        ),
      );

      const tiers = await this.tierRepo.find({
        where: { tier_id: In(distinctTierIds) },
        relations: { conditions: { product: true }, rewards: true },
      });

      const rewardsToRemove: ShoppingCartEntity[] = [];

      for (const reward of rewardUseCodeItems) {
        const tier = tiers.find((t) => t.tier_id === reward.tier_id);
        if (!tier) {
          rewardsToRemove.push(reward);
          continue;
        }

        const conditionCodes = tier.conditions.map((c) => c.product.pro_code);
        const cartItems = cart.filter(
          (c) =>
            c.spc_checked &&
            !c.is_reward &&
            conditionCodes.includes(c.pro_code),
        );

        if (!cartItems.length) {
          rewardsToRemove.push(reward);
          continue;
        }

        let sumPrice = 0;
        for (const item of cartItems) {
          const p = item.product;
          const ratio =
            (p.pro_unit1 === item.spc_unit && p.pro_ratio1) ||
            (p.pro_unit2 === item.spc_unit && p.pro_ratio2) ||
            (p.pro_unit3 === item.spc_unit && p.pro_ratio3) ||
            1;

          const unitPrice =
            priceOption === 'A'
              ? Number(p.pro_priceA)
              : priceOption === 'B'
                ? Number(p.pro_priceB)
                : priceOption === 'C'
                  ? Number(p.pro_priceC)
                  : 0;

          sumPrice += Number(item.spc_amount) * unitPrice * Number(ratio);
        }

        if (sumPrice < Number(tier.min_amount)) {
          rewardsToRemove.push(reward);
        }
      }

      if (rewardsToRemove.length > 0) {
        await this.shoppingCartRepo.remove(rewardsToRemove);
      }
    }

    console.log('Calculating promotion-eligible products in cart');

    // 3) ดึง product ที่อยู่ใน condition ของ promotion ที่ active
    const productInCondition = await this.conRepo
      .createQueryBuilder('cond')
      .innerJoin('cond.tier', 'tier')
      .innerJoin('tier.promotion', 'promo')
      .innerJoin('cond.product', 'prod')
      .select('DISTINCT prod.pro_code', 'pro_code')
      .where('promo.status = :status', { status: true })
      .andWhere('promo.start_date <= :today', { today })
      .andWhere('promo.end_date >= :today', { today })
      .getRawMany<{ pro_code: string }>();

    console.log('Products in promotion conditions:', productInCondition);

    const productCodes = new Set(productInCondition.map((p) => p.pro_code));
    // ❌ อย่าลบ reward และอย่า return ที่นี่ ปล่อยให้ไปเช็ค allProductTiers ต่อ

    // 4) เตรียมตะกร้าพื้นฐาน (ใช้กับ all_products) และตะกร้าแบบมีเงื่อนไขสินค้า
    const promoMonth = new Date().getMonth() + 1;
    const perProductTotalUnits = new Map<string, number>();

    // ตะกร้าพื้นฐาน: ใช้กับทุกกรณี (รวม all_products)
    const baseEligibleCart = cart.filter((line) => {
      if (!line.product) return false;
      if (!line.spc_checked) return false;
      if (line.is_reward) return false;
      if (line.hotdeal_free) return false;
      return true;
    });

    // ใช้ productCodes เฉพาะกรณี promo แบบมี condition
    const checkedCart = baseEligibleCart.filter((line) =>
      productCodes.has(line.pro_code),
    );

    console.log('baseEligibleCart size:', baseEligibleCart.length);
    console.log('checkedCart size (condition products):', checkedCart.length);

    // รวมจำนวนหน่วยต่อรหัสสินค้า (ใช้งานกับ logic โปรรายเดือนของสินค้า ถ้าคุณต้องการ)
    for (const line of baseEligibleCart) {
      const ratio =
        (line.product.pro_unit1 === line.spc_unit && line.product.pro_ratio1) ||
        (line.product.pro_unit2 === line.spc_unit && line.product.pro_ratio2) ||
        (line.product.pro_unit3 === line.spc_unit && line.product.pro_ratio3) ||
        1;

      const baseAmount = Number(line.spc_amount) * Number(ratio || 1);
      perProductTotalUnits.set(
        line.pro_code,
        (perProductTotalUnits.get(line.pro_code) || 0) + baseAmount,
      );
    }

    // 5) คำนวณยอดรวมทั้งหมดสำหรับ all_products จาก baseEligibleCart (สำคัญมาก)
    let totalSumPrice = 0;
    for (const line of baseEligibleCart) {
      const p = line.product;
      const ratio =
        (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
        (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
        (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
        1;

      const totalUnitsSameCode = perProductTotalUnits.get(line.pro_code) || 0;

      // โปรรายเดือนของสินค้า (ถ้าคุณต้องการคงไว้ก็ใช้ isPromo แบบเดิม)
      const isPromo =
        p.pro_promotion_month === promoMonth &&
        totalUnitsSameCode >= (p.pro_promotion_amount ?? 0);

      let unitPrice = 0;
      switch (priceOption) {
        case 'A':
          unitPrice = Number(p.pro_priceA);
          break;
        case 'B':
          unitPrice = Number(p.pro_priceB);
          break;
        case 'C':
          unitPrice = Number(p.pro_priceC);
          break;
        default:
          unitPrice = Number(p.pro_priceC) || 0;
      }

      const linePrice = isPromo
        ? Number(line.spc_amount) * Number(p.pro_priceA) * Number(ratio)
        : Number(line.spc_amount) * unitPrice * Number(ratio);

      totalSumPrice += linePrice;
    }

    if (totalSumPrice <= 0) {
      // ถ้ายอดรวมเป็น 0 ก็ลบ reward (ที่ไม่ใช่ use_code) ทิ้งแล้วจบ
      const rewardLines = cart.filter(
        (c) => c.is_reward && c.spc_checked && c.use_code === false,
      );
      if (rewardLines.length) await this.shoppingCartRepo.remove(rewardLines);
      return;
    }

    // 6) โหลด promotions + tiers
    const promotions = await this.promotionRepo.find({
      where: { status: true },
      relations: { tiers: { rewards: { giftProduct: true } } },
    });

    if (!promotions.length) {
      const rewardLines = cart.filter(
        (c) => c.is_reward && c.spc_checked && c.use_code === false,
      );
      if (rewardLines.length) await this.shoppingCartRepo.remove(rewardLines);
      return;
    }

    const shouldHaveMap = new Map<
      string,
      {
        pro_code: string;
        unit: string;
        qty: number;
        promo_id: number;
        tier_id: number;
      }
    >();

    // 7) Map ของ product ใน condition
    const promoConditions = await this.conRepo
      .createQueryBuilder('cond')
      .innerJoin('cond.tier', 'tier')
      .innerJoin('tier.promotion', 'promo')
      .innerJoin('cond.product', 'prod')
      .select(['promo.promo_id AS promo_id', 'prod.pro_code AS pro_code'])
      .getRawMany<{ promo_id: number; pro_code: string }>();

    const promoConditionMap = new Map<number, Set<string>>();
    for (const { promo_id, pro_code } of promoConditions) {
      if (!promoConditionMap.has(promo_id)) {
        promoConditionMap.set(promo_id, new Set());
      }
      promoConditionMap.get(promo_id)!.add(pro_code);
    }

    // 8) โปรโมชั่นที่ all_products = true (แจกของทุกสินค้า)
    const allProductTiers = await this.tierRepo
      .createQueryBuilder('tier')
      .innerJoinAndSelect('tier.promotion', 'promo')
      .leftJoinAndSelect('tier.rewards', 'reward')
      .leftJoinAndSelect('reward.giftProduct', 'giftProduct')
      .where('tier.all_products = :all', { all: true })
      .andWhere('promo.status = :status', { status: true })
      .andWhere('promo.start_date <= :today', { today })
      .andWhere('promo.end_date >= :today', { today })
      .getMany();

    console.log('All product tiers:', allProductTiers);

    if (allProductTiers.length > 0) {
      const sortedTiers = [...allProductTiers].sort(
        (a, b) => Number(b.min_amount) - Number(a.min_amount),
      );

      let remainingBudget = totalSumPrice;

      for (const tier of sortedTiers) {
        const threshold = Number(tier.min_amount);
        if (!threshold || remainingBudget < threshold) continue;

        const multiplier = Math.floor(remainingBudget / threshold);
        if (multiplier <= 0) continue;

        remainingBudget -= multiplier * threshold;

        for (const rw of tier.rewards || []) {
          const code = rw.giftProduct?.pro_code;
          if (!code) continue;
          const key = `${code}|${rw.unit}`;
          const addQty = Number(rw.qty ?? 0) * multiplier;

          const prev = shouldHaveMap.get(key);
          if (prev) {
            prev.qty += addQty;
          } else {
            shouldHaveMap.set(key, {
              pro_code: code,
              unit: rw.unit,
              qty: addQty,
              promo_id: tier.promotion.promo_id,
              tier_id: tier.tier_id,
            });
          }
        }
      }
    }

    // 9) โปรโมชั่นแบบมี condition ต่อโปรโมชัน (คำนวณจาก baseEligibleCart + conditionCodes)
    for (const promo of promotions) {
      if (!promo.tiers?.length) continue;

      const conditionCodes = promoConditionMap.get(promo.promo_id) || new Set();

      // ใช้ baseEligibleCart แล้วกรองเฉพาะสินค้าตาม condition ของ "โปรโมชันนี้"
      const remaining = baseEligibleCart.reduce((sum, line) => {
        if (!conditionCodes.has(line.pro_code)) return sum;

        const p = line.product;
        const ratio =
          (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
          (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
          (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
          1;
        const price =
          priceOption === 'A'
            ? Number(p.pro_priceA)
            : priceOption === 'B'
              ? Number(p.pro_priceB)
              : Number(p.pro_priceC);

        return sum + Number(line.spc_amount) * price * Number(ratio);
      }, 0);

      console.log(`promo_id=${promo.promo_id}, remaining=${remaining}`);
      if (remaining <= 0) continue;

      const tiersDesc = [...promo.tiers].sort(
        (a, b) => Number(b.min_amount) - Number(a.min_amount),
      );

      let remainingBudget = remaining;
      for (const tier of tiersDesc) {
        const threshold = Number(tier.min_amount);
        if (!threshold || remainingBudget < threshold) continue;

        const multiplier = Math.floor(remainingBudget / threshold);
        if (multiplier <= 0) continue;

        remainingBudget -= multiplier * threshold;

        for (const rw of tier.rewards || []) {
          const code = rw.giftProduct?.pro_code;
          if (!code) continue;
          const key = `${code}|${rw.unit}`;
          const addQty = Number(rw.qty ?? 0) * multiplier;
          const prev = shouldHaveMap.get(key);
          const promo_id = promo.promo_id;
          if (prev) {
            prev.qty += addQty;
          } else {
            shouldHaveMap.set(key, {
              pro_code: code,
              unit: rw.unit,
              qty: addQty,
              promo_id,
              tier_id: tier.tier_id,
            });
          }
        }
      }
    }

    // 10) อัปเดต / ลบของแถมตาม shouldHaveMap
    const rewardInCart = cart.filter((c) => c.is_reward);
    const rewardCartMap = new Map<string, ShoppingCartEntity>();
    for (const r of rewardInCart) {
      rewardCartMap.set(`${r.pro_code}|${r.spc_unit}`, r);
    }

    const toRemove: ShoppingCartEntity[] = [];
    for (const r of rewardInCart) {
      const key = `${r.pro_code}|${r.spc_unit}`;
      if (!shouldHaveMap.has(key) && r.spc_checked && r.use_code === false) {
        toRemove.push(r);
      }
    }
    if (toRemove.length) await this.shoppingCartRepo.remove(toRemove);

    console.log(
      '✅ shouldHaveMap content:',
      Array.from(shouldHaveMap.entries()),
    );

    const ops: Promise<any>[] = [];
    for (const {
      pro_code,
      unit,
      qty,
      promo_id,
      tier_id,
    } of shouldHaveMap.values()) {
      const key = `${pro_code}|${unit}`;
      const existing = rewardCartMap.get(key);
      if (!existing) {
        ops.push(
          this.shoppingCartRepo.save({
            pro_code,
            mem_code,
            spc_unit: unit,
            spc_amount: qty,
            spc_price: 0,
            is_reward: true,
            spc_datetime: new Date(),
            promo_id,
            tier_id,
          }),
        );
      } else if (Number(existing.spc_amount) !== Number(qty)) {
        ops.push(
          this.shoppingCartRepo.update(
            { spc_id: existing.spc_id },
            { spc_amount: qty, spc_datetime: new Date() },
          ),
        );
      }
    }

    if (ops.length) await Promise.all(ops);
  }

  async checkedProductCart(data: {
    pro_code: string;
    mem_code: string;
    type: string;
    priceOption: string;
    clientVersion?: string | number;
  }): Promise<CartMutationResult> {
    try {
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      if (data.type === 'check') {
        await this.shoppingCartRepo.update(
          { pro_code: data.pro_code, mem_code: data.mem_code },
          { spc_checked: true },
        );

        // เช็คว่าสินค้านี้มี hotdeal หรือไม่
        const hotdeal = await this.hotdealService.find(data.pro_code);
        if (hotdeal && hotdeal.product2?.pro_code) {
          // ถ้ามี hotdeal ให้ check สินค้าแถม (hotdeal_free = true) ด้วย
          await this.shoppingCartRepo.update(
            {
              mem_code: data.mem_code,
              pro_code: hotdeal.product2.pro_code,
              hotdeal_free: true,
            },
            { spc_checked: true },
          );
          console.log(
            'Checked hotdeal freebie for pro_code:',
            hotdeal.product2.pro_code,
          );
        }
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          {
            pro_code: data.pro_code,
            mem_code: data.mem_code,
            is_reward: false,
            hotdeal_free: false,
          },
          { spc_checked: false },
        );

        // เช็คว่าสินค้านี้มี hotdeal หรือไม่
        const hotdeal = await this.hotdealService.find(data.pro_code);
        if (hotdeal && hotdeal.product2?.pro_code) {
          // ถ้ามี hotdeal ให้ uncheck สินค้าแถม (hotdeal_free = true) ด้วย
          await this.shoppingCartRepo.update(
            {
              mem_code: data.mem_code,
              pro_code: hotdeal.product2.pro_code,
              hotdeal_free: true,
            },
            { spc_checked: false },
          );
          console.log(
            'Unchecked hotdeal freebie for pro_code:',
            hotdeal.product2.pro_code,
          );
        }
      } else {
        throw new Error('Something wrong in checkedProductCart');
      }

      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');

      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      return { cart, ...version };
    } catch (e) {
      console.error('Error in checkedProductCart', e);
      if (e instanceof ConflictException) {
        throw e;
      }
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
        order: { pro_code: 'ASC' },
      });
    } catch {
      throw new Error('Somthing wrong in handleGetCartToOrder');
    }
  }

  async handleDeleteCart(data: {
    pro_code: string;
    mem_code: string;
    priceOption: string;
    clientVersion?: string | number;
  }): Promise<CartMutationResult> {
    try {
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      // เช็คว่าสินค้านี้มี hotdeal หรือไม่
      const hotdeal = await this.hotdealService.find(data.pro_code);

      if (hotdeal && hotdeal.product2?.pro_code) {
        // ถ้ามี hotdeal ให้ลบสินค้าแถม (hotdeal_free = true) ออกด้วย
        await this.shoppingCartRepo.delete({
          mem_code: data.mem_code,
          pro_code: hotdeal.product2.pro_code,
          hotdeal_free: true,
        });
        console.log(
          'Removed hotdeal freebie for pro_code:',
          hotdeal.product2.pro_code,
        );
      }

      // ลบสินค้าต้นฉบับ
      await this.shoppingCartRepo.delete({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        hotdeal_free: false,
      });
      console.log('priceOption', data.priceOption);
      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');
      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      return { cart, ...version };
    } catch (e) {
      if (e instanceof ConflictException) {
        throw e;
      }
      throw new Error('Somthing wrong in delete product cart');
    }
  }

  async clearCheckoutCart(spc_id: number) {
    try {
      const cartItem = await this.shoppingCartRepo.findOne({
        where: { spc_id },
        select: { mem_code: true },
      });
      await this.shoppingCartRepo.delete(spc_id);
      if (cartItem?.mem_code) {
        await this.incrementCartVersion(cartItem.mem_code);
      }
    } catch {
      throw new Error('Clear Checkout Cart Failed');
    }
  }

  async checkedProductCartAll(data: {
    mem_code: string;
    type: string;
    priceOption: string;
    clientVersion?: string | number;
  }): Promise<CartMutationResult> {
    try {
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      console.log('checkedProductCartAll data : ', data);
      if (data.type === 'check') {
        const productCanNotCheck = await this.shoppingCartRepo
          .createQueryBuilder('cart')
          .leftJoinAndSelect('cart.product', 'product')
          .andWhere(
            new Brackets((qb) => {
              qb.where('product.pro_stock <= 0');
            }),
          )
          .andWhere('cart.mem_code = :mem_code', { mem_code: data.mem_code })
          .select('cart.pro_code')
          .getMany();
        console.log('productCanNotCheck : ', productCanNotCheck);
        await this.shoppingCartRepo.update(
          {
            mem_code: data.mem_code,
            is_reward: false,
            pro_code: Not(In(productCanNotCheck.map((p) => p.pro_code))),
          },
          { spc_checked: true },
        );
      } else if (data.type === 'uncheck') {
        await this.shoppingCartRepo.update(
          { mem_code: data.mem_code, is_reward: false },
          { spc_checked: false },
        );
      } else {
        throw new Error('Somthing wrong in checkedProductCartAll');
      }

      await this.checkPromotionReward(data.mem_code, data.priceOption ?? 'C');

      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      return { cart, ...version };
    } catch (e) {
      console.error('Error in checkedProductCartAll', e);
      if (e instanceof ConflictException) {
        throw e;
      }
      throw new Error('Somthing wrong in checkedProductCartAll');
    }
  }

  async getCartItemCount(mem_code: string): Promise<number> {
    try {
      const result = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .where('cart.mem_code = :mem_code', { mem_code })
        .andWhere('cart.spc_amount > 0')
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
      await this.shoppingCartRepo
        .createQueryBuilder()
        .delete()
        .from(ShoppingCartEntity)
        .where('mem_code = :mem_code', { mem_code })
        .andWhere('spc_amount <= 0')
        .execute();

      const raw: RawProductCart[] = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .leftJoinAndSelect('cart.product', 'product')
        .leftJoinAndSelect('product.lot', 'lot')
        .leftJoinAndSelect('product.flashsale', 'fs')
        .leftJoinAndSelect('fs.flashsale', 'flashsale', 'flashsale.is_active = 1')
        .leftJoinAndSelect('product.recommend', 'recommend')
        .leftJoinAndSelect('product.replace', 'replace')
        .leftJoinAndSelect(
          'recommend.products',
          'recommendedProducts',
          'recommendedProducts.pro_stock > 0',
        )
        .leftJoinAndSelect(
          'recommendedProducts.replace',
          'recommendedProductsReplace',
        )
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
          'product.pro_stock AS pro_stock',
          'product.pro_lowest_stock AS pro_lowest_stock',
          'product.order_quantity AS order_quantity',
          'product.pro_promotion_month AS pro_promotion_month',
          'product.pro_promotion_amount AS pro_promotion_amount',
          'replace.pro_code AS replace_pro_code',
          'replace.pro_imgmain AS replace_pro_imgmain',
          'replace.pro_name AS replace_pro_name',
          'lot.lot_id AS lot_id',
          'lot.lot AS lot',
          'lot.mfg AS mfg',
          'lot.exp AS exp',
          'lot.pro_code AS lot_pro_code',
          'cart.spc_id AS spc_id',
          'cart.spc_amount AS spc_amount',
          'cart.spc_unit AS spc_unit',
          'cart.spc_checked AS spc_checked',
          'cart.is_reward AS is_reward',
          'cart.flashsale_end AS flashsale_end',
          'fs.promotion_id AS promotion_id',
          'fs.limit AS flashsale_limit',
          'flashsale.date AS flashsale_date',
          'flashsale.time_start AS flashsale_time_start',
          'flashsale.time_end AS flashsale_time_end',
          'cart.hotdeal_free AS hotdeal_free',
          'cart.pro_code AS cart_pro_code',
          'recommendedProducts.recommend_id AS recommended_id',
          'recommendedProducts.pro_code AS recommended_pro_code',
          'recommendedProducts.pro_imgmain AS recommended_pro_imgmain',
          'recommendedProducts.pro_name AS recommended_pro_name',
          'recommendedProducts.recommend_rank AS recommend_rank',
          'recommendedProductsReplace.pro_code AS recommended_replace_pro_code',
        ])
        .orderBy('product.pro_code', 'ASC')
        .getRawMany<RawProductCart>();

      const grouped: Record<string, ShoppingProductCart> = {};

      for (const row of raw) {
        const key = `${row.pro_code}_${row.is_reward ? 'reward' : 'normal'}`;

        if (!grouped[key]) {
          grouped[key] = {
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
            pro_stock: row.pro_stock,
            pro_lowest_stock: row.pro_lowest_stock,
            order_quantity: row.order_quantity,
            pro_promotion_month: row.pro_promotion_month,
            pro_promotion_amount: row.pro_promotion_amount,
            flashsale_limit: row.flashsale_limit,
            flashsale_time_end: row.flashsale_time_end,
            flashsale_time_start: row.flashsale_time_start,
            flashsale_date: row.flashsale_date,
            shopping_cart: [],
            lots: [],
            recommend: [],
            is_reward: !!row.is_reward,
          };
        }

        if (row.lot_id) {
          const exists = grouped[key].lots.some((l) => l.lot_id === row.lot_id);

          if (!exists) {
            grouped[key].lots.push({
              lot_id: row.lot_id,
              lot: row.lot,
              mfg: row.mfg,
              exp: row.exp,
            });
          }
        }

        if (row.replace_pro_code) {
          grouped[key].recommend = [
            {
              recommended_id: 1,
              pro_code: row.replace_pro_code,
              pro_imgmain: row.replace_pro_imgmain ?? '',
              pro_name: row.replace_pro_name ?? '',
              recommend_rank: 1,
            },
          ];
        } else if (
          row.recommended_id &&
          row.recommended_pro_code &&
          row.recommended_pro_name &&
          row.recommended_replace_pro_code !== row.pro_code
        ) {
          const exists = grouped[key].recommend.some(
            (r) => r.pro_code === row.recommended_pro_code,
          );
          if (grouped[key].recommend.length < 6 && !exists) {
            grouped[key].recommend.push({
              recommended_id: row.recommended_id,
              pro_code: row.recommended_pro_code,
              pro_imgmain: row.recommended_pro_imgmain ?? '',
              pro_name: row.recommended_pro_name,
              recommend_rank: row.recommend_rank ?? null,
            });
          }
        }

        if (
          !grouped[key].shopping_cart.find((sc) => sc.spc_id === row.spc_id)
        ) {
          grouped[key].shopping_cart.push({
            spc_id: row.spc_id,
            spc_amount: row.spc_amount,
            spc_checked: row.spc_checked,
            spc_unit: row.spc_unit,
            is_reward: !!row.is_reward,
            flashsale_end: row.flashsale_end,
            pro_promotion_month: row.pro_promotion_month,
            pro_promotion_amount: row.pro_promotion_amount,
            hotdeal_free: row.hotdeal_free || false,
            pro_code: row.pro_code,
          });
        }
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

  async removeAllCarthotdeal(pro_code: string): Promise<string> {
    try {
      await this.shoppingCartRepo.delete({
        hotdeal_promain: pro_code,
        hotdeal_free: true,
      });
      return 'Remove All Cart Hotdeal Cart Success';
    } catch (error) {
      console.error('Error removing all hotdeal cart items:', error);
      throw new Error('Error in removeAllCarthotdeal');
    }
  }

  async getProFreebieHotdeal(memCode: string): Promise<
    {
      spc_id: number;
      spc_amount: number;
      spc_unit: string;
      hotdeal_free: boolean;
      pro_code: string;
    }[]
  > {
    try {
      console.log('Fetching freebie products for mem_code:', memCode);
      const freebies = await this.shoppingCartRepo.find({
        where: {
          mem_code: memCode,
          hotdeal_free: true,
        },
      });
      console.log('Found freebies:', freebies);
      return freebies;
    } catch (error) {
      console.error('Error fetching freebie products:', error);
      throw new Error('Error in getProFreebie');
    }
  }

  async checkHotdealByProCode(
    mem_code: string,
    pro_code: string,
  ): Promise<ShoppingProductCart[] | null | undefined> {
    try {
      const existingCart = await this.shoppingCartRepo.find({
        where: {
          mem_code: mem_code,
          pro_code: pro_code,
          hotdeal_free: false,
        },
      });

      const hotdeal = await this.hotdealService.find(pro_code);
      const hotdealMatch = await this.hotdealService.checkHotdealMatch(
        pro_code,
        existingCart.map((item) => ({
          pro1_unit: item.spc_unit,
          pro1_amount: String(Number(item.spc_amount)),
        })),
      );
      console.log('Hotdeal match result:', hotdealMatch, pro_code);
      if (!hotdealMatch?.match) {
        if (hotdeal && hotdeal.product2?.pro_code) {
          await this.shoppingCartRepo.delete({
            mem_code: mem_code,
            pro_code: hotdeal.product2.pro_code,
            hotdeal_free: true,
          });
          console.log(
            'Removed hotdeal freebie for pro_code:',
            hotdeal.product2.pro_code,
            'due to unmatched condition',
          );
        }
        return await this.getProductCart(mem_code);
      }
      if (hotdeal && hotdeal.product2?.pro_code) {
        const existingFreebie = await this.shoppingCartRepo.findOne({
          where: {
            mem_code: mem_code,
            pro_code: hotdeal.product2.pro_code,
            hotdeal_promain: hotdeal.product.pro_code,
            hotdeal_free: true,
          },
        });

        if (existingFreebie) {
          await this.shoppingCartRepo.update(
            {
              mem_code: existingFreebie.mem_code,
              pro_code: hotdeal.product2.pro_code,
              hotdeal_promain: hotdeal.product.pro_code,
              hotdeal_free: true,
            },
            { spc_amount: Number(hotdealMatch?.countFreeBies) },
          );
          return await this.getProductCart(mem_code);
        }

        const result = await this.addProductCartHotDeal(
          {
            mem_code: mem_code ?? '',
            pro_code: hotdeal.product2.pro_code,
            pro_unit: hotdeal.pro2_unit ?? '',
            amount: Number(hotdealMatch?.countFreeBies),
            hotdeal_promain: hotdeal.product.pro_code,
            hotdeal_free: true,
          },
          { touchVersion: false },
        );
        return result.cart;
      }
    } catch (error) {
      console.error('Error in checkHotdealByProCode:', error);
      return null;
    }
  }

  async find(pro_code: string): Promise<ShoppingCartEntity[] | null> {
    try {
      return await this.shoppingCartRepo.find({
        where: { pro_code },
      });
    } catch {
      return null;
    }
  }

  async summaryCart(
    mem_code: string,
  ): Promise<{ total: number; items: { [key: string]: number }[] }> {
    try {
      const result = await this.shoppingCartRepo.find({
        where: {
          mem_code,
          spc_checked: true,
          is_reward: false,
          hotdeal_free: false,
        },
        relations: { product: true, member: true },
        select: {
          spc_amount: true,
          spc_unit: true,
          pro_code: true,
          mem_code: true,
          flashsale_end: true,
          product: {
            pro_code: true,
            pro_priceA: true,
            pro_priceB: true,
            pro_priceC: true,
            pro_unit1: true,
            pro_unit2: true,
            pro_unit3: true,
            pro_ratio1: true,
            pro_ratio2: true,
            pro_ratio3: true,
            pro_promotion_month: true,
            pro_promotion_amount: true,
            flashsale: {
              flashsale: {
                time_end: true,
                time_start: true,
                date: true,
              }
            }
          },
          member: {
            mem_code: true,
            mem_price: true,
          },
        },
        order: { pro_code: 'ASC' },
      });

      const numberOfMonth = new Date().getMonth() + 1;
      const splitData = groupCart(result, 80);

      let total = 0;
      const itemsArray: { index: number; grandTotalItems: number }[] = [];

      for (const [index, dataGroup] of splitData.entries()) {
        const productTotalAmounts = new Map<string, number>();

        for (const item of dataGroup) {
          if (!item.product) continue;

          const unitRatioMap = new Map([
            [item.product.pro_unit1, item.product.pro_ratio1],
            [item.product.pro_unit2, item.product.pro_ratio2],
            [item.product.pro_unit3, item.product.pro_ratio3],
          ]);

          const ratio = unitRatioMap.get(item.spc_unit);
          if (!ratio) {
            throw new Error(
              `Invalid unit ${item.spc_unit} for product ${item.pro_code}`,
            );
          }
          const baseAmount = Number(item.spc_amount) * Number(ratio);

          productTotalAmounts.set(
            item.pro_code,
            (productTotalAmounts.get(item.pro_code) || 0) + baseAmount,
          );
        }

        const promotionProducts: { pro_code: string }[] = [];
        for (const item of dataGroup) {
          if (!item.product) continue;
          const totalAmount = productTotalAmounts.get(item.pro_code) || 0;
          const isPromotionActive =
            item.product.pro_promotion_month === numberOfMonth &&
            totalAmount >= (item.product.pro_promotion_amount ?? 0);

          const isFlashSale = item.flashsale_end
            ? new Date(item.flashsale_end) >= new Date()
            : false;

          if (isPromotionActive || isFlashSale) {
            if (!promotionProducts.find((p) => p.pro_code === item.pro_code)) {
              promotionProducts.push({ pro_code: item.pro_code });
            }
          }
        }

        const priceByCode = new Map<
          string,
          { A: number; B: number; C: number }
        >(
          dataGroup.map((r) => [
            r.pro_code,
            {
              A: Number(r.product?.pro_priceA ?? 0),
              B: Number(r.product?.pro_priceB ?? 0),
              C: Number(r.product?.pro_priceC ?? 0),
            },
          ]),
        );

        const promoSet = new Set<string>(
          promotionProducts.map((p) => p.pro_code),
        );

        const split = dataGroup.reduce(
          (acc, item) => {
            (promoSet.has(item.pro_code) ? acc.promo : acc.nonPromo).push(item);
            return acc;
          },
          {
            promo: [] as typeof dataGroup,
            nonPromo: [] as typeof dataGroup,
          },
        );

        const tier = result[0]?.member?.mem_price ?? 'C';

        const totalByTier = (items: typeof dataGroup, t: 'A' | 'B' | 'C') =>
          items.reduce((sum, item) => {
            const unitRatioMap = new Map([
              [item.product.pro_unit1, item.product.pro_ratio1],
              [item.product.pro_unit2, item.product.pro_ratio2],
              [item.product.pro_unit3, item.product.pro_ratio3],
            ]);
            const ratio = unitRatioMap.get(item.spc_unit) ?? 0;
            const quantity = Number(item.spc_amount) * Number(ratio);
            const price = priceByCode.get(item.pro_code)?.[t] ?? 0;

            return sum + quantity * price;
          }, 0);

        const promoTotal = totalByTier(split.promo, 'A');
        const nonPromoTotal = totalByTier(
          split.nonPromo,
          tier as 'A' | 'B' | 'C',
        );

        const grandTotalItems = promoTotal + nonPromoTotal;
        total += grandTotalItems;
        itemsArray.push({ index: index, grandTotalItems });
      }

      return { total: total, items: itemsArray };
    } catch {
      return { total: 0, items: [] };
    }
  }
}

function groupCart(
  cart: ShoppingCartEntity[],
  limit: number,
): ShoppingCartEntity[][] {
  const groups: ShoppingCartEntity[][] = [];
  let currentGroup: ShoppingCartEntity[] = [];
  let currentCodes = new Set<string>();

  for (const item of cart) {
    if (currentCodes.has(item.pro_code)) {
      currentGroup.push(item);
      continue;
    }
    if (currentCodes.size < limit) {
      currentGroup.push(item);
      currentCodes.add(item.pro_code);
    } else {
      groups.push(currentGroup);
      currentGroup = [item];
      currentCodes = new Set([item.pro_code]);
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
}
