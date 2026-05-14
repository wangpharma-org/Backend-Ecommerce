import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  Repository,
  Not,
  Brackets,
  LessThanOrEqual,
  MoreThanOrEqual,
} from 'typeorm';
import { ProductsService } from '../products/products.service';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { HotdealService } from 'src/hotdeal/hotdeal.service';
import { UserEntity } from 'src/users/users.entity';
import { ProductEntity } from 'src/products/products.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import {
  CompanyDayAnalyticService,
  type CompanyDayContextPayload,
} from 'src/company-day-analytic/company-day-analytic.service';
import { Logger } from '@nestjs/common';
import { DeleteCartEntity } from './delete-cart.entity';

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
  hotdeal: HotdealEntity[] | undefined;
  pointHotdeal?: number | null;
  hotdealPointsInfo?: number;
  totalSmallestUnit?: number;
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
  hotdeal_promain?: string;
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
  spc_unit_enum: '1' | '2' | '3';
  spc_checked: number;
  is_reward: boolean | number;
  flashsale_end?: string;
  flashsale_limit?: number;
  flashsale_time_end?: string;
  flashsale_time_start?: string;
  flashsale_date?: string;
  hotdeal_free: boolean;
  hotdeal_promain?: string;
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

export interface TransformedProductCart {
  pro_code: string;
  pro_name: string;
  pro_imgmain: string;
  pro_priceA: string;
  pro_priceB: string;
  pro_priceC: string;
  pro_stock: number;
  pro_lowest_stock: string;
  order_quantity: number;
  pro_promotion_month: any;
  pro_promotion_amount: number;
  replace_pro_code: any;
  replace_pro_imgmain: any;
  replace_pro_name: any;
  lot_id: any;
  lot: any;
  mfg: any;
  exp: any;
  lot_pro_code: any;
  spc_id: number;
  spc_amount: string;
  spc_unit_enum: string;
  spc_checked: number;
  is_reward: number;
  flashsale_end: any;
  hotdeal_promain: any;
  promotion_id: any;
  flashsale_limit: any;
  flashsale_date: any;
  flashsale_time_start: any;
  flashsale_time_end: any;
  hotdeal_free: number;
  cart_pro_code: string;
  recommended_id: any;
  recommended_pro_code: any;
  recommended_pro_imgmain: any;
  recommended_pro_name: any;
  recommend_rank: any;
  recommended_replace_pro_code: any;
  pro_unit1: string;
  pro_unit2: string;
  pro_unit3: string;
  pro_ratio1: number;
  pro_ratio2: number;
  pro_ratio3: number;
}

interface Hotdeal {
  pro1_unit: string;
  pro2_unit: string;
  id: number;
  product: ProductEntity;
  pro1_amount: string;
  product2: ProductEntity;
  pro2_amount: string;
  order: number;
  special_deal: boolean;
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

export interface CompanyDayRewardContext {
  promo_id: number;
  promo_name: string;
  tier: string;
}

export interface CartMutationWithCompanyDayContext extends CartMutationResult {
  companyDayRewardContext?: CompanyDayRewardContext | null;
}

export interface ShoppingCartItemWithProduct extends ShoppingCartEntity {
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
  pro_stock: number;
  order_quantity: number;
  pro_lowest_stock: number;
  pro_promotion_month: number;
  pro_promotion_amount: number;
  totalSmallestUnit?: number;
}

@Injectable()
export class ShoppingCartService {
  private readonly logger = new Logger(ShoppingCartService.name);
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
    @Inject(forwardRef(() => ProductsService))
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => HotdealService))
    private readonly hotdealService: HotdealService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly companyDayAnalyticService: CompanyDayAnalyticService,
    @InjectRepository(DeleteCartEntity)
    private readonly deleteCartRepo: Repository<DeleteCartEntity>,
  ) { }

  private convertUnitNameToEnum(
    unitName: string,
    product: ProductEntity,
  ): '1' | '2' | '3' {
    const foundUnit = product?.units?.find((u) => u.unit_name === unitName);
    if (!foundUnit) {
      this.logger.warn(
        `[convertUnitNameToEnum] unit name '${unitName}' not found for pro_code '${product?.pro_code}', defaulting to level 1`,
      );
    }
    const unitLevel = foundUnit?.level || 1;
    const validatedUnitLevel = [1, 2, 3].includes(Number(unitLevel))
      ? Number(unitLevel)
      : 1;

    return String(validatedUnitLevel) as '1' | '2' | '3';
  }

  private convertEnumToUnitName(
    unitEnum: 1 | 2 | 3 | string | null | undefined,
    pro_unit1: string,
    pro_unit2: string,
    pro_unit3: string,
  ): string {
    switch (String(unitEnum)) {
      case '1':
        return pro_unit1 || '';
      case '2':
        return pro_unit2 || '';
      case '3':
        return pro_unit3 || '';
      default:
        return '';
    }
  }

  private getRatioFromUnits(
    unitEnum: 1 | 2 | 3 | string,
    productUnits?: { level: number; ratio: number; unit_name: string }[],
  ): number {
    if (!productUnits || productUnits.length === 0) {
      return 1;
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.ratio || 1;
  }

  private async transformProductWithUnits<T extends { pro_code: string }>(
    product: T,
  ): Promise<
    T & {
      pro_unit1: string;
      pro_unit2: string;
      pro_unit3: string;
      pro_ratio1: number;
      pro_ratio2: number;
      pro_ratio3: number;
    }
  > {
    return this.productsService.transformProductWithUnits(product);
  }

  private async calculateSmallestUnitWithTransformed(
    orderItems: Array<{ unit: string; quantity: number; pro_code: string }>,
    pro_code: string,
  ): Promise<number> {
    let total = 0;
    try {
      const transformedProduct = await this.transformProductWithUnits({
        pro_code,
      });

      const units = [
        {
          unit: transformedProduct.pro_unit1,
          ratio: transformedProduct.pro_ratio1,
        },
        {
          unit: transformedProduct.pro_unit2,
          ratio: transformedProduct.pro_ratio2,
        },
        {
          unit: transformedProduct.pro_unit3,
          ratio: transformedProduct.pro_ratio3,
        },
      ].filter((u) => u.unit); // กรองเฉพาะที่มี unit

      // ลูปผ่านทุก orderItem
      for (const orderItem of orderItems) {
        const { unit, quantity } = orderItem;

        // หา ratio จาก units โดยใช้ unit string ที่ส่งมา
        const unitData = units.find((u) => u.unit === unit);
        if (unitData) {
          const totalForItem = quantity * unitData.ratio;
          total += totalForItem;
        }
      }

      return total;
    } catch (error) {
      this.logger.error(
        'Error calculating smallest unit with transformed data:',
        error,
      );
      return 0;
    }
  }

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  private async ensureL16Access(
    mem_code: string,
    pro_code: string,
    mem_route?: string,
  ) {
    const isL16 = await this.isL16Member(mem_code, mem_route);
    if (!isL16) {
      return;
    }
    const product = await this.productRepo.findOne({
      where: { pro_code },
      select: ['pro_code', 'pro_l16_only'],
    });
    if (product?.pro_l16_only === 1) {
      throw new BadRequestException(
        'สินค้านี้ถูกซ่อนจากสมาชิก L16 และไม่สามารถสั่งซื้อได้',
      );
    }
  }

  private async removeExpiredUseCodeRewards(
    cart: ShoppingCartEntity[],
    mem_code: string,
    priceOption: string,
  ): Promise<void> {
    const promoMonth = new Date().getMonth() + 1;

    const rewardUseCodeItems = cart.filter(
      (c) => c.is_reward && c.spc_checked && c.use_code === true,
    );

    if (!rewardUseCodeItems.length) return;

    const distinctTierIds = [
      ...new Set(
        rewardUseCodeItems
          .filter((r) => r.tier_id != null)
          .map((r) => r.tier_id),
      ),
    ];

    const tiers = await this.tierRepo.find({
      where: { tier_id: In(distinctTierIds) },
      relations: { conditions: { product: true }, rewards: true },
    });

    // perProductTotalUnits จาก cart items ปกติ (ไม่ใช่ reward)
    const perProductTotalUnits = new Map<string, number>();
    const baseItems = cart.filter(
      (c) => c.product && c.spc_checked && !c.is_reward && !c.hotdeal_free,
    );

    for (const line of baseItems) {
      const ratio = this.getUnitRatio(line.product, line.spc_unit_enum);
      perProductTotalUnits.set(
        line.pro_code,
        (perProductTotalUnits.get(line.pro_code) ?? 0) +
          Number(line.spc_amount) * ratio,
      );
    }

    const toRemove: ShoppingCartEntity[] = [];

    for (const reward of rewardUseCodeItems) {
      const tier = tiers.find((t) => t.tier_id === reward.tier_id);
      if (!tier) {
        toRemove.push(reward);
        continue;
      }

      const conditionCodes = new Set(
        tier.conditions.map((c) => c.product.pro_code),
      );
      const cartItems = cart.filter(
        (c) => c.spc_checked && !c.is_reward && conditionCodes.has(c.pro_code),
      );

      if (!cartItems.length) {
        toRemove.push(reward);
        continue;
      }

      const sumPrice = cartItems.reduce((sum, item) => {
        const p = item.product;
        const ratio = this.getUnitRatio(p, item.spc_unit_enum);
        const totalUnits = perProductTotalUnits.get(item.pro_code) ?? 0;
        const isPromoPrice =
          p.pro_promotion_month === promoMonth &&
          totalUnits >= (p.pro_promotion_amount ?? 0);

        const unitPrice = isPromoPrice
          ? Number(p.pro_priceA)
          : priceOption === 'A'
            ? Number(p.pro_priceA)
            : priceOption === 'B'
              ? Number(p.pro_priceB)
              : Number(p.pro_priceC);

        return sum + Number(item.spc_amount) * unitPrice * ratio;
      }, 0);

      if (sumPrice < Number(tier.min_amount)) {
        toRemove.push(reward);
      }
    }

    if (toRemove.length) {
      await this.shoppingCartRepo.remove(toRemove);
    }
  }

  private async removeL16ItemsFromCart(
    mem_code: string,
    mem_route?: string,
  ): Promise<boolean> {
    const isL16 = await this.isL16Member(mem_code, mem_route);
    if (!isL16) {
      return false;
    }

    const l16SubQuery = this.shoppingCartRepo
      .createQueryBuilder()
      .subQuery()
      .select('product.pro_code')
      .from(ProductEntity, 'product')
      .where('product.pro_l16_only = :l16')
      .getQuery();

    const deleteMain = await this.shoppingCartRepo
      .createQueryBuilder()
      .delete()
      .from(ShoppingCartEntity)
      .where('mem_code = :mem_code', { mem_code })
      .andWhere(`pro_code IN ${l16SubQuery}`)
      .setParameter('l16', 1)
      .execute();

    const deleteFreebies = await this.shoppingCartRepo
      .createQueryBuilder()
      .delete()
      .from(ShoppingCartEntity)
      .where('mem_code = :mem_code', { mem_code })
      .andWhere('hotdeal_free = true')
      .andWhere(`hotdeal_promain IN ${l16SubQuery}`)
      .setParameter('l16', 1)
      .execute();

    const removed = (deleteMain.affected ?? 0) + (deleteFreebies.affected ?? 0);
    if (removed > 0) {
      await this.incrementCartVersion(mem_code);
      return true;
    }
    return false;
  }

  private normalizeCartVersion(value?: string | number | null): string {
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

  private getUnitRatio(
    product: ProductEntity,
    unitEnum: string | null | undefined,
  ): number {
    if (!unitEnum) return 1;
    const level = Number(unitEnum);
    const units = product.units as
      | { level: number; ratio: number }[]
      | undefined;
    const match = units?.find((u) => u.level === level);
    return match ? Number(match.ratio) : 1;
  }

  private async removeRewardLines(
    cart: ShoppingCartEntity[],
    filter: Partial<ShoppingCartEntity>,
  ) {
    const toRemove = cart.filter(
      (c) =>
        c.is_reward &&
        Object.entries(filter).every(([k, v]) => (c as any)[k] === v),
    );
    if (toRemove.length) await this.shoppingCartRepo.remove(toRemove);
  }

  private async syncRewardsToCart(
    mem_code: string,
    shouldHaveMap: Map<
      string,
      {
        pro_code: string;
        unit: string;
        qty: number;
        promo_id: number;
        tier_id: number;
      }
    >,
  ) {
    const rewardInCart = await this.shoppingCartRepo.find({
      where: { mem_code, is_reward: true },
    });

    // key ตรงกับ shouldHaveMap: pro_code|unit|promo_id
    const rewardCartMap = new Map<string, ShoppingCartEntity>();
    const duplicates: ShoppingCartEntity[] = [];

    for (const r of rewardInCart) {
      // skip use_code rewards
      if (r.use_code) continue;
      const key = `${r.pro_code}|${r.spc_unit_enum}|${r.promo_id}`;
      if (rewardCartMap.has(key)) duplicates.push(r);
      else rewardCartMap.set(key, r);
    }

    const toRemove = [...duplicates];
    for (const r of rewardInCart) {
      if (r.use_code) continue;
      const key = `${r.pro_code}|${r.spc_unit_enum}|${r.promo_id}`;
      if (!shouldHaveMap.has(key) && r.spc_checked) toRemove.push(r);
    }

    if (toRemove.length) {
      await this.shoppingCartRepo.remove(toRemove);
      // refresh
      rewardCartMap.clear();
      const refreshed = await this.shoppingCartRepo.find({
        where: { mem_code, is_reward: true },
      });
      for (const r of refreshed) {
        if (!r.use_code) {
          rewardCartMap.set(
            `${r.pro_code}|${r.spc_unit_enum}|${r.promo_id}`,
            r,
          );
        }
      }
    }

    const ops: Promise<any>[] = [];
    for (const {
      pro_code,
      unit,
      qty,
      promo_id,
      tier_id,
    } of shouldHaveMap.values()) {
      const key = `${pro_code}|${unit}|${promo_id}`;
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
      } else if (
        Number(existing.spc_amount) !== qty ||
        existing.tier_id !== tier_id ||
        existing.promo_id !== promo_id
      ) {
        ops.push(
          this.shoppingCartRepo.update(
            { spc_id: existing.spc_id },
            { spc_amount: qty, tier_id, promo_id, spc_datetime: new Date() },
          ),
        );
      }
    }
    if (ops.length) await Promise.all(ops);
  }

  private async syncConditionTagsToCart(
    baseEligibleCart: ShoppingCartEntity[],
    conditionTagMap: Map<number, { promo_id: number; tier_id: number }>,
  ) {
    const ops: Promise<any>[] = [];
    for (const line of baseEligibleCart) {
      const tag = conditionTagMap.get(line.spc_id);
      if (tag) {
        if (line.promo_id !== tag.promo_id || line.tier_id !== tag.tier_id) {
          ops.push(
            this.shoppingCartRepo.update(
              { spc_id: line.spc_id },
              { promo_id: tag.promo_id, tier_id: tag.tier_id },
            ),
          );
        }
      } else if (line.promo_id != null || line.tier_id != null) {
        ops.push(
          this.shoppingCartRepo.update(
            { spc_id: line.spc_id },
            { promo_id: null as any, tier_id: null as any },
          ),
        );
      }
    }
    if (ops.length) await Promise.all(ops);
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

  async getCartSnapshot(
    mem_code: string,
    mem_route?: string,
  ): Promise<CartMutationResult> {
    await this.removeL16ItemsFromCart(mem_code, mem_route);
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
      relations: { flashsale: { flashsale: true } },
    });
    if (
      !data ||
      !data.flashsale ||
      data.flashsale[0]?.flashsale.is_active === false
    ) {
      await this.shoppingCartRepo.update({ pro_code }, { flashsale_end: null });
      throw new Error('No flashsale data found');
    }
  }

  async callCheckCartPromotion() {
    try {
      const shoppingCarts = await this.shoppingCartRepo.find({
        select: {
          member: { mem_code: true, mem_price: true },
        },
        relations: { member: true },
      });

      const uniqueMembers = new Map<
        string,
        { mem_code: string; mem_price: string }
      >();

      for (const cart of shoppingCarts) {
        if (!uniqueMembers.has(cart.member.mem_code)) {
          uniqueMembers.set(cart.member.mem_code, {
            mem_code: cart.member.mem_code,
            mem_price: cart.member.mem_price,
          });
        }
      }

      for (const member of uniqueMembers.values()) {
        await this.checkPromotionReward(member.mem_code, member.mem_price);
      }
    } catch (error) {
      console.error('Error in Check Cart Promotion:', error);
      throw new Error('Error in Check Cart Promotion');
    }
  }

  async addProductCart(data: {
    mem_code: string;
    pro_code: string;
    pro_unit: string;
    amount: number;
    priceCondition: string;
    mem_route?: string;
    flashsale_end?: string;
    clientVersion?: string | number;
    company_day_source?: string;
  }): Promise<CartMutationResult> {
    try {
      if (data.flashsale_end) {
        await this.handleCheckFlashsale(data.pro_code);
      }

      await this.ensureL16Access(data.mem_code, data.pro_code, data.mem_route);

      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);

      // [ขาเข้า] แปลงชื่อหน่วยเป็น enum level
      const product = await this.productRepo.findOne({
        where: { pro_code: data.pro_code },
        relations: ['units'],
      });

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      const unitEnum = this.convertUnitNameToEnum(data.pro_unit, product);
      // const unitEnum = await this.convertUnitNameToEnum(data.pro_unit, product);

      const existing = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit_enum: unitEnum,
          hotdeal_free: false,
          is_reward: false,
        },
      });

      if (existing) {
        const newAmount = Number(existing.spc_amount) + data.amount;
        if (newAmount > 0) {
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
          }
        }
      } else {
        await this.shoppingCartRepo.save({
          pro_code: data.pro_code,
          mem_code: data.mem_code,
          spc_unit_enum: unitEnum,
          spc_amount: data.amount,
          spc_price: 0,
          is_reward: false,
          spc_datetime: new Date(),
          flashsale_end: data.flashsale_end ?? undefined,
          spc_comments: '',
          hotdeal_free: false,
        });
      }
      await this.checkHotdealByProCode(data.mem_code, data.pro_code);
      const checkedResult = await this.checkedProductCart({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        type: 'check',
        priceOption: data.priceCondition,
        mem_route: data.mem_route,
      });

      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      if (Number(data.amount) > 0) {
        const source = data.company_day_source?.trim() || 'Cart';
        const companyDayContext = checkedResult.companyDayRewardContext;
        if (companyDayContext) {
          const payload: CompanyDayContextPayload = {
            ...companyDayContext,
            source,
          };
          void this.companyDayAnalyticService.emitEvent(
            'addcart',
            data.mem_code,
            payload,
          );
        }
      }
      return { cart, ...version };
    } catch (error) {
      this.logger.error('Error saving product cart:', error);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
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
      mem_route?: string;
      clientVersion?: string | number;
    },
    options?: { touchVersion?: boolean },
  ): Promise<CartMutationResult> {
    const touchVersion = options?.touchVersion ?? true;
    try {
      await this.ensureL16Access(data.mem_code, data.pro_code, data.mem_route);
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);

      const product = await this.productRepo.findOne({
        where: { pro_code: data.pro_code },
        relations: ['units'],
      });

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      const unitEnum = this.convertUnitNameToEnum(data.pro_unit, product);

      await this.shoppingCartRepo.save({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        spc_unit_enum: unitEnum,
        spc_amount: data.amount,
        spc_price: 0,
        hotdeal_free: true,
        hotdeal_promain: data.hotdeal_promain,
        spc_datetime: new Date(),
      });
      const cart = await this.getProductCart(data.mem_code);
      const version = touchVersion
        ? await this.incrementCartVersion(data.mem_code)
        : await this.getCartVersionState(data.mem_code);
      return { cart, ...version };
    } catch (error) {
      this.logger.error('Error saving product cart:', error);
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      throw new Error('Error in Add product Cart');
    }
  }

  async checkPromotionReward(
    mem_code: string,
    priceOption: string,
  ): Promise<CompanyDayRewardContext | null> {
    const today = new Date();
    const promoMonth = today.getMonth() + 1;
    const isL16 = await this.isL16Member(mem_code);

    // ─── 1. โหลด cart ─────────────────────────────────────────────────────────
    const cart = await this.shoppingCartRepo.find({
      where: { mem_code },
      relations: { product: { units: true } },
    });

    // ─── 2. ลบ reward-use-code ที่ไม่ qualify แล้ว ────────────────────────────
    await this.removeExpiredUseCodeRewards(cart, mem_code, priceOption);

    // ─── 3. baseEligibleCart + perProductTotalUnits ───────────────────────────
    const baseEligibleCart = cart.filter(
      (l) => l.product && l.spc_checked && !l.is_reward && !l.hotdeal_free,
    );

    const perProductTotalUnits = new Map<string, number>();
    for (const line of baseEligibleCart) {
      const ratio = this.getUnitRatio(line.product, line.spc_unit_enum);
      perProductTotalUnits.set(
        line.pro_code,
        (perProductTotalUnits.get(line.pro_code) ?? 0) +
          Number(line.spc_amount) * ratio,
      );
    }

    // ─── 4. โหลด active promotions ───────────────────────────────────────────
    const promotions = await this.promotionRepo.find({
      where: {
        status: true,
        start_date: LessThanOrEqual(today),
        end_date: MoreThanOrEqual(today),
      },
      relations: { tiers: { rewards: { giftProduct: true } } },
    });

    if (!promotions.length) {
      await this.removeRewardLines(cart, { use_code: false });
      return null;
    }

    // ─── 5. Build promoConditionMap ───────────────────────────────────────────
    const promoConditions = await this.conRepo
      .createQueryBuilder('cond')
      .innerJoin('cond.tier', 'tier')
      .innerJoin('tier.promotion', 'promo')
      .innerJoin('cond.product', 'prod')
      .select(['tier.tier_id AS tier_id', 'prod.pro_code AS pro_code'])
      .getRawMany<{ tier_id: number; pro_code: string }>();

    const promoConditionMap = new Map<number, Set<string>>();
    for (const { tier_id, pro_code } of promoConditions) {
      if (!promoConditionMap.has(tier_id))
        promoConditionMap.set(tier_id, new Set());
      promoConditionMap.get(tier_id)!.add(pro_code);
    }

    // ─── helper: คำนวณ line value ─────────────────────────────────────────────
    const getLineValue = (line: ShoppingCartEntity): number => {
      const p = line.product;
      const ratio = this.getUnitRatio(p, line.spc_unit_enum);
      const totalUnits = perProductTotalUnits.get(line.pro_code) ?? 0;
      const isPromoPrice =
        p.pro_promotion_month === promoMonth &&
        totalUnits >= (p.pro_promotion_amount ?? 0);

      const unitPrice = isPromoPrice
        ? Number(p.pro_priceA)
        : priceOption === 'A'
          ? Number(p.pro_priceA)
          : priceOption === 'B'
            ? Number(p.pro_priceB)
            : Number(p.pro_priceC);

      return Number(line.spc_amount) * unitPrice * ratio;
    };

    // shouldHaveMap: key = `pro_code|unit|promo_id` (ไม่รวม tier_id เพื่อ merge qty)
    // แต่ต้องเก็บ tier_id ไว้ด้วย → ใช้ dominant tier (tier ที่ใหญ่ที่สุด)
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

    const conditionTagMap = new Map<
      number,
      { promo_id: number; tier_id: number }
    >();

    // ─── 6. Condition-based tiers (greedy cascade, gross budget) ─────────────
    const conditionBasedTiers = promotions
      .flatMap(
        (promo) =>
          promo.tiers?.map((tier) => ({ ...tier, promotion: promo })) ?? [],
      )
      .filter(
        (tier) => !tier.all_products && promoConditionMap.has(tier.tier_id),
      )
      .sort((a, b) => Number(b.min_amount) - Number(a.min_amount));

    // grossBudget/Units ต่อ tier_id: คำนวณครั้งเดียวก่อนเริ่ม loop
    // แทนที่จะหัก consumedItems (ซึ่งเป็น root cause ของ bug)
    // ใช้ "remaining budget after larger tiers" แทน
    const usedSpcIds = new Set<number>(); // ใช้เฉพาะ is_unit tiers

    // สำหรับ amount-based: เก็บ grossValue ต่อ spc_id ไว้ล่วงหน้า
    const lineGrossValue = new Map<number, number>();
    for (const line of baseEligibleCart) {
      lineGrossValue.set(line.spc_id, getLineValue(line));
    }

    // remainingBudgetPerItem: เท่ากับ grossValue ตอนเริ่ม แล้วหักเมื่อ tier ใหญ่กว่า consume
    const remainingValuePerItem = new Map<number, number>(lineGrossValue);

    const selectedTierContexts: Array<
      CompanyDayRewardContext & { min_amount: number }
    > = [];

    for (const tier of conditionBasedTiers) {
      const threshold = Number(tier.min_amount);
      if (!threshold) continue;

      const conditionCodes = promoConditionMap.get(tier.tier_id)!;

      const eligibleItems = baseEligibleCart.filter((line) => {
        if (!conditionCodes.has(line.pro_code)) return false;
        if (tier.is_unit) return !usedSpcIds.has(line.spc_id);
        return true;
      });

      // ── คำนวณ tierValue จาก remaining value (ไม่ใช่ gross) ──────────────────
      let tierValue: number;
      if (tier.is_unit) {
        tierValue = eligibleItems.reduce((sum, line) => {
          const ratio = this.getUnitRatio(line.product, line.spc_unit_enum);
          return sum + Number(line.spc_amount) * ratio;
        }, 0);
      } else {
        tierValue = eligibleItems.reduce(
          (sum, line) => sum + (remainingValuePerItem.get(line.spc_id) ?? 0),
          0,
        );
      }

      if (tierValue < threshold) continue;

      const multiplier = Math.floor(tierValue / threshold);
      if (multiplier <= 0) continue;

      selectedTierContexts.push({
        promo_id: tier.promotion.promo_id,
        promo_name:
          tier.promotion.promo_name?.trim() ??
          `Company Day - ${tier.tier_name}`,
        tier: tier.tier_name,
        min_amount: threshold,
      });

      // ── หัก remaining value (multiplier × threshold) จาก items ──────────────
      if (!tier.is_unit) {
        let toDeduct = multiplier * threshold;
        for (const line of eligibleItems) {
          if (toDeduct <= 0) break;
          const avail = remainingValuePerItem.get(line.spc_id) ?? 0;
          const deduct = Math.min(avail, toDeduct);
          remainingValuePerItem.set(line.spc_id, avail - deduct);
          toDeduct -= deduct;

          // mark fully consumed items
          if ((remainingValuePerItem.get(line.spc_id) ?? 0) <= 0) {
            usedSpcIds.add(line.spc_id);
          }
        }
      } else {
        for (const line of eligibleItems) usedSpcIds.add(line.spc_id);
      }

      // tag สินค้าหลัก
      for (const line of eligibleItems) {
        if (!conditionTagMap.has(line.spc_id)) {
          conditionTagMap.set(line.spc_id, {
            promo_id: tier.promotion.promo_id,
            tier_id: tier.tier_id,
          });
        }
      }

      // ── Grant rewards — merge ด้วย key ที่ไม่รวม tier_id ────────────────────
      for (const rw of tier.rewards ?? []) {
        if (isL16 && rw.giftProduct?.pro_l16_only === 1) continue;
        const code = rw.giftProduct?.pro_code;
        if (!code) continue;

        // key ไม่รวม tier_id: pro_code|unit|promo_id
        const mergeKey = `${code}|${rw.unit}|${tier.promotion.promo_id}`;
        const addQty = Number(rw.qty ?? 0) * multiplier;
        const prev = shouldHaveMap.get(mergeKey);

        if (prev) {
          prev.qty += addQty;
          // ใช้ tier ที่ใหญ่กว่า (dominant) สำหรับ tier_id ใน cart row
          if (threshold > Number(prev.tier_id)) {
            prev.tier_id = tier.tier_id;
          }
        } else {
          shouldHaveMap.set(mergeKey, {
            pro_code: code,
            unit: rw.unit,
            qty: addQty,
            promo_id: tier.promotion.promo_id,
            tier_id: tier.tier_id,
          });
        }
      }
    }

    // ─── 7. All-products tiers (จาก remaining budget) ────────────────────────
    const remainingEligibleCart = baseEligibleCart.filter(
      (l) => !usedSpcIds.has(l.spc_id),
    );

    const totalRemainingBudget = remainingEligibleCart.reduce(
      (sum, l) => sum + (remainingValuePerItem.get(l.spc_id) ?? 0),
      0,
    );
    const totalRemainingUnits = remainingEligibleCart.reduce((sum, l) => {
      const ratio = this.getUnitRatio(l.product, l.spc_unit_enum);
      return sum + Number(l.spc_amount) * ratio;
    }, 0);

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

    if (allProductTiers.length) {
      const sortedAllTiers = [...allProductTiers].sort(
        (a, b) => Number(b.min_amount) - Number(a.min_amount),
      );

      let remainingBudget = totalRemainingBudget;
      let remainingUnits = totalRemainingUnits;

      for (const tier of sortedAllTiers) {
        const threshold = Number(tier.min_amount);
        if (!threshold) continue;

        const pool = tier.is_unit ? remainingUnits : remainingBudget;
        if (pool < threshold) continue;

        const multiplier = Math.floor(pool / threshold);
        if (multiplier <= 0) continue;

        if (tier.is_unit) remainingUnits -= multiplier * threshold;
        else remainingBudget -= multiplier * threshold;

        selectedTierContexts.push({
          promo_id: tier.promotion.promo_id,
          promo_name:
            tier.promotion.promo_name?.trim() ??
            `Company Day - ${tier.tier_name}`,
          tier: tier.tier_name,
          min_amount: threshold,
        });

        for (const line of remainingEligibleCart) {
          if (!conditionTagMap.has(line.spc_id)) {
            conditionTagMap.set(line.spc_id, {
              promo_id: tier.promotion.promo_id,
              tier_id: tier.tier_id,
            });
          }
        }

        for (const rw of tier.rewards ?? []) {
          if (isL16 && rw.giftProduct?.pro_l16_only === 1) continue;
          const code = rw.giftProduct?.pro_code;
          if (!code) continue;

          const mergeKey = `${code}|${rw.unit}|${tier.promotion.promo_id}`;
          const addQty = Number(rw.qty ?? 0) * multiplier;
          const prev = shouldHaveMap.get(mergeKey);

          if (prev) {
            prev.qty += addQty;
          } else {
            shouldHaveMap.set(mergeKey, {
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

    // ─── 8. Sync rewards ใน cart ──────────────────────────────────────────────
    await this.syncRewardsToCart(mem_code, shouldHaveMap);

    // ─── 9. Sync promo_id/tier_id บน non-reward items ────────────────────────
    await this.syncConditionTagsToCart(baseEligibleCart, conditionTagMap);

    if (!selectedTierContexts.length) return null;

    selectedTierContexts.sort((a, b) => {
      if (b.min_amount !== a.min_amount) return b.min_amount - a.min_amount;
      if (a.promo_id !== b.promo_id) return a.promo_id - b.promo_id;
      return a.tier.localeCompare(b.tier);
    });

    const top = selectedTierContexts[0];
    return {
      promo_id: top.promo_id,
      promo_name: top.promo_name,
      tier: top.tier,
    };
  }

  async checkedProductCart(data: {
    pro_code: string;
    mem_code: string;
    type: string;
    priceOption: string;
    mem_route?: string;
    clientVersion?: string | number;
  }): Promise<CartMutationWithCompanyDayContext> {
    try {
      await this.ensureCartVersionFresh(data.mem_code, data.clientVersion);
      await this.ensureL16Access(data.mem_code, data.pro_code, data.mem_route);
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
        }
      } else {
        throw new Error('Something wrong in checkedProductCart');
      }

      const companyDayRewardContext = await this.checkPromotionReward(
        data.mem_code,
        data.priceOption ?? 'C',
      );

      const cart = await this.getProductCart(data.mem_code);
      const version = await this.incrementCartVersion(data.mem_code);
      return { cart, ...version, companyDayRewardContext };
    } catch (e) {
      this.logger.error('Error in checkedProductCart', e);
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
        relations: ['product', 'product.units'],
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
      const hotdeal = await this.hotdealService.find(data.pro_code);

      if (hotdeal && hotdeal.product2?.pro_code) {
        await this.shoppingCartRepo.delete({
          mem_code: data.mem_code,
          hotdeal_promain: data.pro_code,
          hotdeal_free: true,
        });
      }

      await this.shoppingCartRepo.delete({
        pro_code: data.pro_code,
        mem_code: data.mem_code,
        hotdeal_free: false,
      });
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
      this.logger.error('Error in checkedProductCartAll', e);
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
      this.logger.error('Error getting cart item count:', error);
      throw new Error('Error in getCartItemCount');
    }
  }

  async getProductCart(mem_code: string): Promise<ShoppingProductCart[]> {
    try {
      await this.removeL16ItemsFromCart(mem_code);
      await this.shoppingCartRepo
        .createQueryBuilder()
        .delete()
        .from(ShoppingCartEntity)
        .where('mem_code = :mem_code', { mem_code })
        .andWhere('spc_amount <= 0')
        .execute();

      const isL16 = await this.isL16Member(mem_code);
      const replaceCondition = isL16
        ? 'replace.pro_l16_only = 0 OR replace.pro_l16_only IS NULL'
        : undefined;
      const recommendCondition = isL16
        ? 'recommendedProducts.pro_stock > 0 AND (recommendedProducts.pro_l16_only = 0 OR recommendedProducts.pro_l16_only IS NULL)'
        : 'recommendedProducts.pro_stock > 0';
      const replaceInRecommendCondition = isL16
        ? 'recommendedProductsReplace.pro_l16_only = 0 OR recommendedProductsReplace.pro_l16_only IS NULL'
        : undefined;

      const raw: RawProductCart[] = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .leftJoinAndSelect('cart.product', 'product')
        .leftJoinAndSelect('product.lot', 'lot')
        .leftJoinAndSelect('product.flashsale', 'fs')
        .leftJoinAndSelect(
          'fs.flashsale',
          'flashsale',
          'flashsale.is_active = 1',
        )
        .leftJoinAndSelect('product.recommend', 'recommend')
        .leftJoinAndSelect('product.replace', 'replace', replaceCondition)
        .leftJoinAndSelect(
          'recommend.products',
          'recommendedProducts',
          recommendCondition,
        )
        .leftJoinAndSelect(
          'recommendedProducts.replace',
          'recommendedProductsReplace',
          replaceInRecommendCondition,
        )
        .where('cart.mem_code = :mem_code', { mem_code })
        .select([
          'product.pro_code AS pro_code',
          'product.pro_name AS pro_name',
          'product.pro_imgmain AS pro_imgmain',
          'product.pro_priceA AS pro_priceA',
          'product.pro_priceB AS pro_priceB',
          'product.pro_priceC AS pro_priceC',
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
          'cart.spc_unit_enum AS spc_unit_enum',
          'cart.spc_checked AS spc_checked',
          'cart.is_reward AS is_reward',
          'cart.flashsale_end AS flashsale_end',
          'cart.hotdeal_promain AS hotdeal_promain',
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

      const allProCodes = [...new Set(raw.map((r) => r.pro_code))];
      const allHotdeals =
        await this.hotdealService.getHotdealByProCode(allProCodes);

      // Transform ข้อมูล units สำหรับทุก products ที่ unique
      const uniqueProducts = allProCodes.map((pro_code) => ({
        pro_code,
        // เอาข้อมูลอื่นๆ จาก raw row แรกที่เจอ
        ...raw.find((r) => r.pro_code === pro_code),
      }));

      const transformedProductsMap = new Map<string, any>();
      for (const product of uniqueProducts) {
        const transformed = await this.transformProductWithUnits(product);
        transformedProductsMap.set(product.pro_code, transformed);
      }
      // คำนวณ used points สำหรับแต่ละสินค้า
      const usedPointsPromises = allProCodes.map((proCode) =>
        this.calculateUsedHotdealPoints(mem_code, proCode),
      );
      const usedPointsResults = await Promise.all(usedPointsPromises);
      const usedPointsMap = new Map(
        allProCodes.map((proCode, index) => [
          proCode,
          usedPointsResults[index],
        ]),
      );

      // คำนวณ hotdeal points info แบบละเอียด (แต้มที่เหลือหลังหักของแถม)
      const hotdealPointsInfoPromises = allProCodes.map(async (proCode) => {
        // getHotdealPointsInfo คืนค่า remainingPoints (แต้มที่เหลือ)
        return this.getHotdealPointsInfo(mem_code, proCode);
      });
      const hotdealPointsInfoResults = await Promise.all(
        hotdealPointsInfoPromises,
      );
      const hotdealPointsInfoMap = new Map(
        allProCodes.map((proCode, index) => [
          proCode,
          hotdealPointsInfoResults[index], // แต้มที่เหลือ
        ]),
      );

      for (const row of raw) {
        const key = `${row.pro_code}_${row.is_reward ? 'reward' : 'normal'}`;

        const usedHotdealPoints = usedPointsMap.get(row.pro_code) || 0;
        const hotdealPointsInfo = hotdealPointsInfoMap.get(row.pro_code);
        const transformedProduct = transformedProductsMap.get(
          row.pro_code,
        ) as TransformedProductCart;

        const hotdeal = allHotdeals?.filter(
          (hd) => hd.product.pro_code === row.pro_code,
        );
        if (!grouped[key]) {
          grouped[key] = {
            pro_code: row.pro_code,
            pro_name: row.pro_name,
            pro_imgmain: row.pro_imgmain,
            pro_priceA: row.pro_priceA,
            pro_priceB: row.pro_priceB,
            pro_priceC: row.pro_priceC,
            pro_unit1: transformedProduct?.pro_unit1 || '',
            pro_unit2: transformedProduct?.pro_unit2 || '',
            pro_unit3: transformedProduct?.pro_unit3 || '',
            pro_ratio1: transformedProduct?.pro_ratio1 || 1,
            pro_ratio2: transformedProduct?.pro_ratio2 || 1,
            pro_ratio3: transformedProduct?.pro_ratio3 || 1,
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
            hotdeal: hotdeal,
            pointHotdeal: usedHotdealPoints,
            hotdealPointsInfo: hotdealPointsInfo,
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
          const transformedProduct = transformedProductsMap.get(
            row.pro_code,
          ) as TransformedProductCart;
          const displayUnit = this.convertEnumToUnitName(
            row.spc_unit_enum,
            transformedProduct?.pro_unit1 || '',
            transformedProduct?.pro_unit2 || '',
            transformedProduct?.pro_unit3 || '',
          );

          if (!displayUnit) {
            await this.shoppingCartRepo.delete({ spc_id: row.spc_id });
          } else {
            grouped[key].shopping_cart.push({
              spc_id: row.spc_id,
              spc_amount: row.spc_amount,
              spc_checked: row.spc_checked,
              spc_unit: displayUnit,
              is_reward: !!row.is_reward,
              flashsale_end: row.flashsale_end,
              pro_promotion_month: row.pro_promotion_month,
              pro_promotion_amount: row.pro_promotion_amount,
              hotdeal_free: row.hotdeal_free || false,
              pro_code: row.pro_code,
              hotdeal_promain: row.hotdeal_promain,
            });
          }
        }
      }

      for (const key of Object.keys(grouped)) {
        if (grouped[key].shopping_cart.length === 0) {
          delete grouped[key];
        }
      }

      const totalSmallestUnit = Object.values(grouped).map((group) => {
        let total = 0;
        const transformedProduct = transformedProductsMap.get(
          group.pro_code,
        ) as TransformedProductCart;

        // สร้าง units array จาก transformed data
        const units = [
          {
            unit: transformedProduct?.pro_unit1 || '',
            ratio: transformedProduct?.pro_ratio1 || 1,
          },
          {
            unit: transformedProduct?.pro_unit2 || '',
            ratio: transformedProduct?.pro_ratio2 || 1,
          },
          {
            unit: transformedProduct?.pro_unit3 || '',
            ratio: transformedProduct?.pro_ratio3 || 1,
          },
        ].filter((u) => u.unit); // กรองเฉพาะที่มี unit

        // คำนวณ totalSmallestUnit ด้วยตัวเอง
        for (const item of group.shopping_cart) {
          const unitData = units.find((u) => u.unit === item.spc_unit);
          if (unitData) {
            const totalForItem = parseFloat(item.spc_amount) * unitData.ratio;
            total += totalForItem;
          }
        }

        return total;
      });

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
      this.logger.error('Error get product cart:', error);
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
      this.logger.error('Error removing all hotdeal cart items:', error);
      throw new Error('Error in removeAllCarthotdeal');
    }
  }

  async getProFreebieHotdeal(memCode: string): Promise<
    {
      spc_id: number;
      spc_amount: number;
      spc_unit_enum: '1' | '2' | '3';
      hotdeal_free: boolean;
      pro_code: string;
    }[]
  > {
    try {
      const freebies = await this.shoppingCartRepo.find({
        where: {
          mem_code: memCode,
          hotdeal_free: true,
        },
      });
      return freebies;
    } catch (error) {
      this.logger.error('Error fetching freebie products:', error);
      throw new Error('Error in getProFreebie');
    }
  }

  async checkHotdealByProCode(
    mem_code: string,
    pro_code: string,
  ): Promise<ShoppingProductCart[] | null | undefined> {
    try {
      const hotdeals: Hotdeal[] | null =
        await this.hotdealService.getHotdealByProCode([pro_code]);
      if (!hotdeals || hotdeals.length === 0) {
        return await this.getProductCart(mem_code);
      }

      const mainProductsInCart = await this.shoppingCartRepo.find({
        where: {
          mem_code,
          pro_code: pro_code,
          hotdeal_free: false,
          spc_checked: true,
        },
      });

      const allFreebiesInCart = await this.shoppingCartRepo.find({
        where: {
          mem_code,
          hotdeal_promain: pro_code,
          hotdeal_free: true,
        },
      });

      if (mainProductsInCart.length === 0) {
        if (allFreebiesInCart.length > 0) {
          await this.shoppingCartRepo.remove(allFreebiesInCart);
        }
        return await this.getProductCart(mem_code);
      }

      const freebiesData: {
        pro_code: string;
        unit: string;
        quantity: number;
      }[] = [];

      const getHotdealFromproCode =
        await this.hotdealService.getHotdealFromproCode(pro_code, mem_code);
      let totalCartInSmallest =
        getHotdealFromproCode?.totalAmountInSmallestUnit || 0;

      const minPoint = Math.min(
        ...hotdeals.map((hd) => Number(hd.pro1_amount)),
      );
      const bestHotdeal = hotdeals.filter(
        (hd) => Number(hd.pro1_amount) === minPoint,
      );
      for (const hd of bestHotdeal) {
        if (!hd.pro1_amount || !hd.pro1_unit || !hd.product2?.pro_code) {
          continue;
        }
        const hotdealRequirement = [
          {
            pro_code: pro_code,
            unit: hd.pro1_unit,
            quantity: Number(hd.pro1_amount),
          },
        ];

        const hotdealRequiredInSmallest =
          await this.calculateSmallestUnitWithTransformed(
            hotdealRequirement,
            pro_code,
          );
        if (hotdealRequiredInSmallest <= 0) {
          continue;
        }

        try {
          const totalFreebies = Math.floor(
            totalCartInSmallest / hotdealRequiredInSmallest,
          );

          if (totalFreebies > 0) {
            freebiesData.push({
              pro_code: hd.product2.pro_code,
              unit: hd.pro2_unit,
              quantity: totalFreebies * Number(hd.pro2_amount),
            });
          }

          totalCartInSmallest -= totalFreebies * hotdealRequiredInSmallest;
        } catch (error) {
          this.logger.error(`Error processing hotdeal ${hd.id}:`, error);
          continue;
        }
      }

      if (freebiesData.length === 0) {
        if (allFreebiesInCart.length > 0) {
          await this.shoppingCartRepo.remove(allFreebiesInCart);
        }
        return await this.getProductCart(mem_code);
      }

      const freebiesMap = new Map<
        string,
        { pro_code: string; unit: string; quantity: number }
      >();
      for (const f of freebiesData) {
        const key = `${f.pro_code}::${f.unit}`;
        const existing = freebiesMap.get(key);
        if (existing) {
          existing.quantity += f.quantity;
        } else {
          freebiesMap.set(key, { ...f });
        }
      }
      const mergedFreebies = Array.from(freebiesMap.values());

      const validFreebieProCodes = new Set(mergedFreebies.map((f) => f.pro_code));

      const freebiesToRemove = allFreebiesInCart.filter(
        (fb) => !validFreebieProCodes.has(fb.pro_code),
      );
      if (freebiesToRemove.length > 0) {
        await this.shoppingCartRepo.remove(freebiesToRemove);
      }

      for (const freebieData of mergedFreebies) {
        const existingFreebie = allFreebiesInCart.find(
          (fb) => fb.pro_code === freebieData.pro_code && fb.spc_unit_enum === freebieData.unit,
        );
        if (existingFreebie) {
          if (Number(existingFreebie.spc_amount) !== freebieData.quantity) {
            await this.shoppingCartRepo.update(
              { spc_id: existingFreebie.spc_id },
              { spc_amount: freebieData.quantity },
            );
          }
        }
      }

      for (const freebieData of mergedFreebies) {
        const existingFreebie = allFreebiesInCart.find(
          (fb) => fb.pro_code === freebieData.pro_code && fb.spc_unit_enum === freebieData.unit,
        );
        if (!existingFreebie) {
          await this.addProductCartHotDeal(
            {
              mem_code: mem_code,
              pro_code: freebieData.pro_code,
              pro_unit: freebieData.unit,
              amount: freebieData.quantity,
              hotdeal_promain: pro_code,
              hotdeal_free: true,
            },
            { touchVersion: false },
          );
        }
      }

      return await this.getProductCart(mem_code);
    } catch (error) {
      this.logger.error('Error in checkHotdealByProCode:', error);
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
      const result = await this.shoppingCartRepo
        .createQueryBuilder('cart')
        .leftJoinAndSelect('cart.product', 'product')
        .leftJoinAndSelect('product.flashsale', 'productFlashsale')
        .leftJoinAndSelect('productFlashsale.flashsale', 'flashsale')
        .leftJoinAndSelect('product.units', 'units')
        .leftJoinAndSelect('cart.member', 'member')
        .select([
          'cart.spc_id',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.pro_code',
          'cart.mem_code',
          'cart.flashsale_end',
          'product.pro_code',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_promotion_month',
          'product.pro_promotion_amount',
          'productFlashsale',
          'flashsale.promotion_id',
          'flashsale.time_end',
          'flashsale.time_start',
          'flashsale.date',
          'units.unit_name',
          'units.level',
          'units.ratio',
          'member.mem_code',
          'member.mem_price',
        ])
        .where('cart.mem_code = :mem_code', { mem_code })
        .andWhere('cart.spc_checked = :spc_checked', { spc_checked: true })
        .andWhere('cart.is_reward = :is_reward', { is_reward: false })
        .andWhere('cart.hotdeal_free = :hotdeal_free', { hotdeal_free: false })
        .orderBy('cart.pro_code', 'ASC')
        .getMany();

      const numberOfMonth = new Date().getMonth() + 1;
      const splitData = groupCart(result, 80);

      let total = 0;
      const itemsArray: { index: number; grandTotalItems: number }[] = [];

      for (const [index, dataGroup] of splitData.entries()) {
        const productTotalAmounts = new Map<string, number>();

        for (const item of dataGroup) {
          if (!item.product) continue;

          let ratio = 1;
          const matchedUnit = item.product.units?.find(
            (u) =>
              u.unit_name === item.spc_unit_enum ||
              String(u.level) === String(item.spc_unit_enum),
          );
          if (matchedUnit) {
            ratio = matchedUnit.ratio;
          } else {
            throw new Error(
              `Invalid unit enum ${item.spc_unit_enum} for product ${item.pro_code}`,
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
            let ratio = 0;
            const matchedUnit = item.product.units?.find(
              (u) =>
                u.unit_name === item.spc_unit_enum ||
                String(u.level) === String(item.spc_unit_enum),
            );
            if (matchedUnit) ratio = matchedUnit.ratio;
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

  async getOrderFromCartMember(
    mem_code: string,
    pro_code: string,
  ): Promise<
    {
      pro_code: string;
      spc_amount: number;
      spc_unit: string;
      hotdeal_free: boolean;
    }[]
  > {
    try {
      const cartItems = await this.shoppingCartRepo.find({
        where: {
          mem_code: mem_code,
          pro_code: pro_code,
          spc_checked: true,
        },
        relations: { product: { units: true } },
        select: {
          pro_code: true,
          spc_amount: true,
          spc_unit_enum: true,
          hotdeal_free: true,
          product: {
            pro_code: true,
          },
        },
      });

      // แปลง enum เป็นชื่อหน่วยจริง
      const transformedItems = await Promise.all(
        cartItems.map(async (item) => {
          let spc_unit = '';

          if (item.product) {
            const transformedProduct = await this.transformProductWithUnits(
              item.product,
            );
            spc_unit = this.convertEnumToUnitName(
              item.spc_unit_enum,
              transformedProduct.pro_unit1,
              transformedProduct.pro_unit2,
              transformedProduct.pro_unit3,
            );
          }

          return {
            pro_code: item.pro_code,
            spc_amount: item.spc_amount,
            spc_unit,
            hotdeal_free: item.hotdeal_free,
          };
        }),
      );

      return transformedItems;
    } catch {
      return [];
    }
  }

  async addHotdealToCart(
    mem_code: string,
    freebies: {
      pro_code: string;
      unit: string;
      amount: number;
      pro_code1: string;
    }[],
  ) {
    try {
      for (const data of freebies) {
        // ตรวจสอบข้อมูลพื้นฐานก่อนดำเนินการ
        if (!data.pro_code || !data.pro_code1 || !data.unit) {
          this.logger.warn(
            `Skipping invalid hotdeal data: ${JSON.stringify(data)}`,
          );
          continue;
        }
        this.logger.log(`Processing hotdeal freebie: ${JSON.stringify(data)}`);
        // เช็คจำนวนสินค้าหลักในตะกร้าเพื่อคำนวณแต้ม (หน่วยที่เล็กที่สุด)
        const mainProductInCart = await this.shoppingCartRepo.find({
          where: {
            mem_code,
            pro_code: data.pro_code1, // สินค้าหลักที่ต้องซื้อ
            hotdeal_free: false,
            spc_checked: true,
          },
        });
        this.logger.log(
          `Found main products in cart: ${JSON.stringify(mainProductInCart)}`,
        );

        if (mainProductInCart.length === 0) {
          this.logger.log(
            `No main product found in cart for pro_code1: ${data.pro_code1}, skipping hotdeal freebie.`,
          );
          continue;
        }
        // เช็คว่าครบเงื่อนไข hotdeal หรือไม่
        // แปลง spc_unit_enum เป็นชื่อหน่วยจริงสำหรับการเช็ค
        const mainProductInCartWithUnitNames = await Promise.all(
          mainProductInCart.map(async (item) => {
            const mainProduct = await this.productRepo.findOne({
              where: { pro_code: item.pro_code },
              relations: ['units'],
            });

            if (!mainProduct) {
              return {
                pro1_unit: item.spc_unit_enum,
                pro1_amount: item.spc_amount.toString(),
              };
            }

            const transformedMainProduct =
              await this.transformProductWithUnits(mainProduct);
            const unitName = this.convertEnumToUnitName(
              item.spc_unit_enum,
              transformedMainProduct.pro_unit1,
              transformedMainProduct.pro_unit2,
              transformedMainProduct.pro_unit3,
            );

            return {
              pro1_unit: unitName,
              pro1_amount: item.spc_amount.toString(),
            };
          }),
        );

        const hotdealMatch = await this.hotdealService.checkHotdealMatch(
          data.pro_code1,
          mainProductInCartWithUnitNames,
        );

        if (!hotdealMatch?.match) {
          // ลบของแถมที่มีอยู่ถ้าเงื่อนไขไม่ครบ
          await this.shoppingCartRepo.delete({
            mem_code,
            pro_code: data.pro_code,
            hotdeal_promain: data.pro_code1,
            hotdeal_free: true,
          });
          continue;
        }

        this.logger.log(
          `Hotdeal conditions met for pro_code1: ${data.pro_code1}, processing freebie: ${data.pro_code}`,
        );

        // ถ้าครบเงื่อนไขแล้ว จึงเพิ่มหรืออัปเดตของแถม
        const existingFreebie = await this.shoppingCartRepo.findOne({
          where: {
            mem_code,
            pro_code: data.pro_code,
            hotdeal_promain: data.pro_code1,
            hotdeal_free: true,
          },
        });

        this.logger.log(`Existing freebie: ${JSON.stringify(existingFreebie)}`);

        const actualFreebieAmount = Math.min(
          data.amount,
          Number(hotdealMatch.countFreeBies) || 0,
        );

        this.logger.log(
          `Processing hotdeal freebie for mem_code: ${mem_code}, pro_code: ${data.pro_code}, required amount: ${data.amount}, actual freebie amount: ${actualFreebieAmount}`,
        );

        if (existingFreebie) {
          await this.shoppingCartRepo.update(
            {
              mem_code,
              pro_code: data.pro_code,
              hotdeal_promain: data.pro_code1,
              hotdeal_free: true,
            },
            { spc_amount: actualFreebieAmount },
          );
        } else {
          // แปลงชื่อหน่วยเป็น enum level สำหรับสินค้าแถม
          const freebieProduct = await this.productRepo.findOne({
            where: { pro_code: data.pro_code },
            relations: ['units'],
          });

          if (!freebieProduct) {
            this.logger.warn(`Freebie product not found: ${data.pro_code}`);
            continue;
          }

          const transformedFreebieProduct =
            await this.transformProductWithUnits(freebieProduct);

          // หา enum level จากชื่อหน่วย
          let unitEnum: '1' | '2' | '3' = '1'; // default
          if (data.unit === transformedFreebieProduct.pro_unit1) {
            unitEnum = '1';
          } else if (data.unit === transformedFreebieProduct.pro_unit2) {
            unitEnum = '2';
          } else if (data.unit === transformedFreebieProduct.pro_unit3) {
            unitEnum = '3';
          } else {
            this.logger.warn(
              `Unit not found for freebie ${data.pro_code}: ${data.unit}, using default '1'`,
            );
          }

          this.logger.log(
            `Adding/updating hotdeal freebie for mem_code: ${mem_code}, pro_code: ${data.pro_code}, unitEnum: ${unitEnum}, amount: ${actualFreebieAmount}`,
          );

          const hotdeal = this.shoppingCartRepo.create({
            pro_code: data.pro_code,
            mem_code,
            spc_unit_enum: unitEnum,
            spc_amount: actualFreebieAmount,
            hotdeal_promain: data.pro_code1,
            spc_checked: true,
            hotdeal_free: true,
            spc_datetime: new Date(),
          });

          this.logger.log('Adding hotdeal freebie to cart:', hotdeal);

          await this.shoppingCartRepo.save(hotdeal);
        }
      }
      return 'Add Hotdeal To Cart Success';
    } catch (error) {
      // เพิ่มการ log error เดิมเพื่อช่วยในการ debug
      this.logger.error(
        'An error occurred in addHotdealToCart:',
        error instanceof Error ? error.message : error,
      );
      throw new Error('Error in addHotdealToCart'); // โยน error เดิมออกไป
    }
  }

  async calculateUsedHotdealPoints(
    mem_code: string,
    pro_code: string,
  ): Promise<number> {
    try {
      // ดึงรายการของแถม (hotdeal_free = true) ที่เกิดจากสินค้าหลัก pro_code
      const freebies = await this.shoppingCartRepo.find({
        where: {
          mem_code,
          hotdeal_promain: pro_code,
          hotdeal_free: true,
          spc_checked: true,
        },
        relations: { product: true },
      });
      if (freebies.length === 0) {
        return 0;
      }

      // ดึงข้อมูล hotdeal สำหรับสินค้าหลัก
      const hotdeals: HotdealEntity[] | null =
        await this.hotdealService.getHotdealByProCode([pro_code]);
      if (!hotdeals || hotdeals.length === 0) {
        return 0;
      }

      let totalUsedPoints = 0;

      // คำนวณแต้มที่ใช้สำหรับแต่ละของแถม
      for (const freebie of freebies) {
        // แปลง spc_unit_enum เป็นชื่อหน่วยจริงก่อน
        let freebieUnitName = '';
        if (freebie.product) {
          const transformedProduct = await this.transformProductWithUnits(
            freebie.product,
          );
          freebieUnitName = this.convertEnumToUnitName(
            freebie.spc_unit_enum,
            transformedProduct.pro_unit1,
            transformedProduct.pro_unit2,
            transformedProduct.pro_unit3,
          );
        } else {
          freebieUnitName = String(freebie.spc_unit_enum);
        }

        // หา hotdeal rule ที่ตรงกับของแถมนี้ (เทียบด้วยชื่อหน่วย string)
        const matchingHotdeal = hotdeals.find(
          (hd) =>
            hd.product2?.pro_code === freebie.pro_code &&
            hd.pro2_unit === freebieUnitName,
        );

        if (
          matchingHotdeal &&
          matchingHotdeal.pro1_amount &&
          matchingHotdeal.pro1_unit
        ) {
          // คำนวณแต้มที่ต้องใช้สำหรับของแถม 1 หน่วย
          const requiredItems = [
            {
              pro_code: pro_code,
              unit: matchingHotdeal.pro1_unit,
              quantity: Number(matchingHotdeal.pro1_amount),
            },
          ];

          const pointsPerFreebie =
            await this.calculateSmallestUnitWithTransformed(
              requiredItems,
              pro_code,
            );

          // คำนวณแต้มรวมที่ใช้ = จำนวนของแถม × แต้มต่อหน่วย
          const freebieAmount = Number(freebie.spc_amount);
          totalUsedPoints += freebieAmount * pointsPerFreebie;
        }
      }

      return totalUsedPoints;
    } catch (error) {
      this.logger.error('Error calculating used hotdeal points:', error);
      return 0;
    }
  }

  async getHotdealPointsInfo(
    mem_code: string,
    pro_code: string,
  ): Promise<number> {
    try {
      // คำนวณแต้มทั้งหมดที่มีในตะกร้า
      const mainProductsInCart = await this.shoppingCartRepo.find({
        where: {
          mem_code,
          pro_code,
          hotdeal_free: false,
          spc_checked: true,
        },
        relations: { product: { units: true } },
      });

      if (mainProductsInCart.length === 0) {
        return 0;
      }

      // แปลง spc_unit_enum เป็น unit name สำหรับการคำนวณ
      const transformedProduct = await this.transformProductWithUnits({
        pro_code,
      });
      const cartItemsWithUnitNames = mainProductsInCart.map((item) => {
        const unitName = this.convertEnumToUnitName(
          item.spc_unit_enum,
          transformedProduct.pro_unit1,
          transformedProduct.pro_unit2,
          transformedProduct.pro_unit3,
        );
        return {
          pro_code: item.pro_code,
          unit: unitName,
          quantity: Number(item.spc_amount),
        };
      });

      const totalPoints = await this.calculateSmallestUnitWithTransformed(
        cartItemsWithUnitNames,
        pro_code,
      );
      const usedPoints = await this.calculateUsedHotdealPoints(
        mem_code,
        pro_code,
      );
      const remainingPoints = Math.max(0, totalPoints - usedPoints);

      return remainingPoints;
    } catch (error) {
      this.logger.error('Error getting hotdeal points info:', error);
      return 0;
    }
  }

  async softDeleteCartItem(mem_code: string, pro_code: string) {
    try {
      const item = await this.deleteCartRepo.findOne({
        where: { mem_code, product: { pro_code } },
        relations: { product: true },
      });
      if (!item) return;
      await this.deleteCartRepo.softDelete(item.id);
    } catch (error) {
      console.error('Error soft deleting cart item:', error);
    }
  }

  async getDeleteCartItem(mem_code: string) {
    try {
      return await this.deleteCartRepo.find({
        where: {
          mem_code,
        },
        relations: {
          product: true,
        },
        select: {
          product: {
            pro_code: true,
            pro_name: true,
            pro_imgmain: true,
          },
        },
      });
    } catch (error) {
      console.error('Error getting delete cart items:', error);
      return [];
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
