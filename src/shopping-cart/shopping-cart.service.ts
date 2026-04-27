import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
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
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import {
  CompanyDayAnalyticService,
  type CompanyDayContextPayload,
} from 'src/company-day-analytic/company-day-analytic.service';
import { Logger } from '@nestjs/common';

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
  spc_unit: string;
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
    private readonly productsService: ProductsService,
    @Inject(forwardRef(() => HotdealService))
    private readonly hotdealService: HotdealService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly companyDayAnalyticService: CompanyDayAnalyticService,
  ) {}

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
      const existing = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit: data.pro_unit,
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

      if (data.hotdeal_free && data.hotdeal_promain) {
        const remainingPoints = await this.getHotdealPointsInfo(
          data.mem_code,
          data.hotdeal_promain,
        );

        if (remainingPoints <= 0) {
          const cart = await this.getProductCart(data.mem_code);
          const version = touchVersion
            ? await this.incrementCartVersion(data.mem_code)
            : await this.getCartVersionState(data.mem_code);
          return { cart, ...version };
        }

        const hotdeals = await this.hotdealService.getHotdealByProCode([
          data.hotdeal_promain,
        ]);

        const matchingHotdeal = hotdeals?.find(
          (hd) =>
            hd.product2?.pro_code === data.pro_code &&
            hd.pro2_unit === data.pro_unit,
        );

        if (
          matchingHotdeal &&
          matchingHotdeal.pro1_amount &&
          matchingHotdeal.pro1_unit
        ) {
          const pointsPerFreebieSet =
            await this.productsService.calculateSmallestUnit([
              {
                pro_code: data.hotdeal_promain,
                unit: matchingHotdeal.pro1_unit,
                quantity: Number(matchingHotdeal.pro1_amount),
              },
            ]);

          if (pointsPerFreebieSet > 0) {
            const possibleSets = Math.floor(
              remainingPoints / pointsPerFreebieSet,
            );
            const missingAmount =
              possibleSets * Number(matchingHotdeal.pro2_amount);

            if (missingAmount <= 0) {
              const cart = await this.getProductCart(data.mem_code);
              const version = touchVersion
                ? await this.incrementCartVersion(data.mem_code)
                : await this.getCartVersionState(data.mem_code);
              return { cart, ...version };
            }

            if (data.amount > missingAmount) {
              data.amount = missingAmount;
            }
          }
        }
      }

      const existingFreebie = await this.shoppingCartRepo.findOne({
        where: {
          mem_code: data.mem_code,
          pro_code: data.pro_code,
          spc_unit: data.pro_unit,
          hotdeal_promain: data.hotdeal_promain,
          hotdeal_free: true,
        },
      });

      if (existingFreebie) {
        await this.shoppingCartRepo.update(
          { spc_id: existingFreebie.spc_id },
          {
            spc_amount: Number(existingFreebie.spc_amount) + data.amount,
            spc_datetime: new Date(),
          },
        );
      } else {
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
      }

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
    const isL16 = await this.isL16Member(mem_code);
    const selectedTierContexts: Array<
      CompanyDayRewardContext & { min_amount: number }
    > = [];

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
      return null;
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

    // Map สำหรับ tag สินค้าหลักที่เข้าเงื่อนไขโปรโมชั่น (keyed by spc_id)
    const conditionTagMap = new Map<
      number,
      { promo_id: number; tier_id: number }
    >();

    // 7) Map ของ product ใน condition
    const promoConditions = await this.conRepo
      .createQueryBuilder('cond')
      .innerJoin('cond.tier', 'tier')
      .innerJoin('tier.promotion', 'promo')
      .innerJoin('cond.product', 'prod')
      .select([
        'promo.promo_id AS promo_id',
        'tier.tier_id AS tier_id',
        'prod.pro_code AS pro_code',
      ])
      .getRawMany<{ promo_id: number; tier_id: number; pro_code: string }>();

    const promoConditionMap = new Map<number, Set<string>>();
    for (const { tier_id, pro_code } of promoConditions) {
      if (!promoConditionMap.has(tier_id)) {
        promoConditionMap.set(tier_id, new Set());
      }
      promoConditionMap.get(tier_id)!.add(pro_code);
    }

    // --- REORDERED LOGIC ---
    // 8) โปรโมชั่นแบบมี condition (Greedy approach) - ทำก่อนเพราะเจาะจงกว่า
    const conditionBasedTiers = promotions
      .flatMap(
        (promo) =>
          promo.tiers?.map((tier) => ({ ...tier, promotion: promo })) ?? [],
      )
      .filter(
        (tier) => !tier.all_products && promoConditionMap.has(tier.tier_id),
      )
      .sort((a, b) => Number(b.min_amount) - Number(a.min_amount));

    const usedSpcIds = new Set<number>();

    console.log('Condition-based tiers to evaluate:', conditionBasedTiers);

    // คำนวณโปรโมชั่นแบบ cascade (จากมากไปน้อย)
    const processedTierIds = new Set<number>();
    const consumedItems = new Map<number, number>(); // spc_id -> consumed value

    for (const tier of conditionBasedTiers) {
      const threshold = Number(tier.min_amount);
      if (!threshold) continue;

      const conditionCodes = promoConditionMap.get(tier.tier_id)!;
      const eligibleItemsForTier = baseEligibleCart.filter((line) =>
        conditionCodes.has(line.pro_code),
      );

      // เช็คว่าเป็นการเช็คจำนวนหน่วย (is_unit = true) หรือเช็คยอดเงิน (is_unit = false)
      let tierValue: number;

      if (tier.is_unit) {
        // เช็คจำนวนหน่วย
        tierValue = eligibleItemsForTier.reduce((sum, line) => {
          const p = line.product;
          const ratio =
            (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
            (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
            (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
            1;
          return sum + Number(line.spc_amount) * Number(ratio);
        }, 0);
      } else {
        // เช็คยอดเงิน (ระบบเดิม)
        tierValue = eligibleItemsForTier.reduce((sum, line) => {
          const p = line.product;
          const ratio =
            (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
            (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
            (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
            1;

          const totalUnitsSameCode =
            perProductTotalUnits.get(line.pro_code) || 0;

          const isPromo =
            p.pro_promotion_month === promoMonth &&
            totalUnitsSameCode >= (p.pro_promotion_amount ?? 0);

          if (isPromo) {
            return (
              sum +
              Number(line.spc_amount) * Number(p.pro_priceA) * Number(ratio)
            );
          } else {
            const price =
              priceOption === 'A'
                ? Number(p.pro_priceA)
                : priceOption === 'B'
                  ? Number(p.pro_priceB)
                  : Number(p.pro_priceC);
            return sum + Number(line.spc_amount) * price * Number(ratio);
          }
        }, 0);
      }

      console.log(
        'Tier:',
        tier.tier_id,
        tier.tier_name,
        'Available tier value:',
        tierValue,
        'Threshold:',
        threshold,
      );
      if (tierValue >= threshold) {
        const multiplier = Math.floor(tierValue / threshold);
        if (multiplier <= 0) continue;

        selectedTierContexts.push({
          promo_id: tier.promotion.promo_id,
          promo_name:
            tier.promotion.promo_name?.trim() ||
            `Company Day - ${tier.tier_name}`,
          tier: tier.tier_name,
          min_amount: threshold,
        });

        // คำนวณส่วนที่ใช้ไปสำหรับแต่ละ item และบันทึกลง consumedItems
        const totalConsumedValue = multiplier * threshold;
        let remainingConsume = totalConsumedValue;

        for (const line of eligibleItemsForTier) {
          if (remainingConsume <= 0) break;

          const p = line.product;
          const ratio =
            (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
            (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
            (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
            1;

          const totalUnitsSameCode =
            perProductTotalUnits.get(line.pro_code) || 0;
          const isPromo =
            p.pro_promotion_month === promoMonth &&
            totalUnitsSameCode >= (p.pro_promotion_amount ?? 0);

          let lineValue;
          if (isPromo) {
            lineValue =
              Number(line.spc_amount) * Number(p.pro_priceA) * Number(ratio);
          } else {
            const price =
              priceOption === 'A'
                ? Number(p.pro_priceA)
                : priceOption === 'B'
                  ? Number(p.pro_priceB)
                  : Number(p.pro_priceC);
            lineValue = Number(line.spc_amount) * price * Number(ratio);
          }

          const alreadyConsumed = consumedItems.get(line.spc_id) || 0;
          const availableValue = Math.max(0, lineValue - alreadyConsumed);
          const toConsume = Math.min(availableValue, remainingConsume);

          if (toConsume > 0) {
            consumedItems.set(line.spc_id, alreadyConsumed + toConsume);
            remainingConsume -= toConsume;
          }
        }

        // Mark items as used and tag them
        for (const line of eligibleItemsForTier) {
          usedSpcIds.add(line.spc_id);
          if (!conditionTagMap.has(line.spc_id)) {
            conditionTagMap.set(line.spc_id, {
              promo_id: tier.promotion.promo_id,
              tier_id: tier.tier_id,
            });
          }
        }

        // Grant rewards
        for (const rw of tier.rewards || []) {
          if (isL16 && rw.giftProduct?.pro_l16_only === 1) continue;
          const code = rw.giftProduct?.pro_code;
          if (!code) continue;

          const key = `${code}|${rw.unit}|${tier.promotion.promo_id}|${tier.tier_id}`;
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

      processedTierIds.add(tier.tier_id);
    }

    // 9) คำนวณยอดรวม/จำนวนหน่วยรวมของสินค้าที่ "ยังไม่ได้ใช้" ในโปรโมชั่นแบบมีเงื่อนไข
    const remainingEligibleCart = baseEligibleCart.filter(
      (line) => !usedSpcIds.has(line.spc_id),
    );

    const totalSumPriceForUnusedItems = remainingEligibleCart.reduce(
      (sum, line) => {
        const p = line.product;
        const ratio =
          (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
          (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
          (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
          1;
        const totalUnitsSameCode = perProductTotalUnits.get(line.pro_code) || 0;
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
        return sum + linePrice;
      },
      0,
    );

    // คำนวณจำนวนหน่วยรวมสำหรับสินค้าที่เหลือ (สำหรับโปรแบบ is_unit = true)
    const totalUnitsForUnusedItems = remainingEligibleCart.reduce(
      (sum, line) => {
        const p = line.product;
        const ratio =
          (p.pro_unit1 === line.spc_unit && p.pro_ratio1) ||
          (p.pro_unit2 === line.spc_unit && p.pro_ratio2) ||
          (p.pro_unit3 === line.spc_unit && p.pro_ratio3) ||
          1;
        return sum + Number(line.spc_amount) * Number(ratio);
      },
      0,
    );

    // 10) โปรโมชั่นที่ all_products = true (คำนวณจากสินค้าที่เหลือ)
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

    if (allProductTiers.length > 0) {
      const sortedTiers = [...allProductTiers].sort(
        (a, b) => Number(b.min_amount) - Number(a.min_amount),
      );

      let remainingBudget = totalSumPriceForUnusedItems;
      let remainingUnits = totalUnitsForUnusedItems;

      for (const tier of sortedTiers) {
        const threshold = Number(tier.min_amount);
        let multiplier = 0;
        
        if (tier.is_unit) {
          // เช็คจำนวนหน่วย
          if (!threshold || remainingUnits < threshold) continue;
          multiplier = Math.floor(remainingUnits / threshold);
          if (multiplier <= 0) continue;
          remainingUnits -= multiplier * threshold;
        } else {
          // เช็คยอดเงิน (ระบบเดิม)
          if (!threshold || remainingBudget < threshold) continue;
          multiplier = Math.floor(remainingBudget / threshold);
          if (multiplier <= 0) continue;
          remainingBudget -= multiplier * threshold;
        }

        selectedTierContexts.push({
          promo_id: tier.promotion.promo_id,
          promo_name:
            tier.promotion.promo_name?.trim() ||
            `Company Day - ${tier.tier_name}`,
          tier: tier.tier_name,
          min_amount: threshold,
        });

        // Tag สินค้าหลักที่เหลือ ว่าเข้าโปรนี้
        for (const line of remainingEligibleCart) {
          if (!conditionTagMap.has(line.spc_id)) {
            conditionTagMap.set(line.spc_id, {
              promo_id: tier.promotion.promo_id,
              tier_id: tier.tier_id,
            });
          }
        }

        for (const rw of tier.rewards || []) {
          if (isL16 && rw.giftProduct?.pro_l16_only === 1) continue;
          const code = rw.giftProduct?.pro_code;
          if (!code) continue;
          const key = `${code}|${rw.unit}|${tier.promotion.promo_id}|${tier.tier_id}`;
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

    // 11) อัปเดต / ลบของแถมตาม shouldHaveMap
    const rewardInCart = cart.filter((c) => c.is_reward);
    const rewardCartMap = new Map<string, ShoppingCartEntity>();
    for (const r of rewardInCart) {
      rewardCartMap.set(
        `${r.pro_code}|${r.spc_unit}|${r.promo_id}|${r.tier_id}`,
        r,
      );
    }

    const toRemove: ShoppingCartEntity[] = [];
    for (const r of rewardInCart) {
      const key = `${r.pro_code}|${r.spc_unit}|${r.promo_id}|${r.tier_id}`;
      if (!shouldHaveMap.has(key) && r.spc_checked && r.use_code === false) {
        toRemove.push(r);
      }
    }
    if (toRemove.length) await this.shoppingCartRepo.remove(toRemove);

    const ops: Promise<any>[] = [];
    for (const {
      pro_code,
      unit,
      qty,
      promo_id,
      tier_id,
    } of shouldHaveMap.values()) {
      const key = `${pro_code}|${unit}|${promo_id}|${tier_id}`;
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
        Number(existing.spc_amount) !== Number(qty) ||
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

    // 12) Sync promo_id/tier_id บนสินค้าหลัก (non-reward) ตาม conditionTagMap
    const conditionSyncOps: Promise<any>[] = [];
    for (const line of baseEligibleCart) {
      const tag = conditionTagMap.get(line.spc_id);
      if (tag) {
        if (
          (line.promo_id ?? null) !== tag.promo_id ||
          (line.tier_id ?? null) !== tag.tier_id
        ) {
          conditionSyncOps.push(
            this.shoppingCartRepo.update(
              { spc_id: line.spc_id },
              { promo_id: tag.promo_id, tier_id: tag.tier_id },
            ),
          );
        }
      } else if (line.promo_id != null || line.tier_id != null) {
        conditionSyncOps.push(
          this.shoppingCartRepo.update(
            { spc_id: line.spc_id },
            {
              promo_id: null as unknown as number,
              tier_id: null as unknown as number,
            },
          ),
        );
      }
    }
    if (conditionSyncOps.length) await Promise.all(conditionSyncOps);

    if (selectedTierContexts.length === 0) {
      return null;
    }

    selectedTierContexts.sort((a, b) => {
      if (b.min_amount !== a.min_amount) {
        return b.min_amount - a.min_amount;
      }
      if (a.promo_id !== b.promo_id) {
        return a.promo_id - b.promo_id;
      }
      return a.tier.localeCompare(b.tier);
    });

    const topTier = selectedTierContexts[0];
    return {
      promo_id: topTier.promo_id,
      promo_name: topTier.promo_name,
      tier: topTier.tier,
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

      // คำนวณ hotdeal points info แบบละเอียด
      const hotdealPointsInfoPromises = allProCodes.map((proCode) =>
        this.getHotdealPointsInfo(mem_code, proCode),
      );
      const hotdealPointsInfoResults = await Promise.all(
        hotdealPointsInfoPromises,
      );
      const hotdealPointsInfoMap = new Map(
        allProCodes.map((proCode, index) => [
          proCode,
          hotdealPointsInfoResults[index],
        ]),
      );

      for (const row of raw) {
        const key = `${row.pro_code}_${row.is_reward ? 'reward' : 'normal'}`;

        const usedHotdealPoints = usedPointsMap.get(row.pro_code) || 0;
        const hotdealPointsInfo = hotdealPointsInfoMap.get(row.pro_code);

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
            hotdeal_promain: row.hotdeal_promain,
          });
        }
      }

      const totalSmallestUnit = await Promise.all(
        Object.values(grouped).map(async (group) => {
          const orderItems = group.shopping_cart.map((item) => ({
            unit: item.spc_unit,
            quantity: parseFloat(item.spc_amount),
            pro_code: group.pro_code,
          }));

          // คำนวณหน่วยที่เล็กที่สุดสำหรับ pro_code นี้
          return this.productsService.calculateSmallestUnit(orderItems);
        }),
      );

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
      spc_unit: string;
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
      const hotdeals = await this.hotdealService.getHotdealByProCode([
        pro_code,
      ]);
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

        try {
          const cartByUnit = new Map<string, number>();
          for (const item of mainProductsInCart) {
            const currentQty = cartByUnit.get(item.spc_unit) || 0;
            cartByUnit.set(item.spc_unit, currentQty + Number(item.spc_amount));
          }

          const hotdealRequirement = [
            {
              pro_code: pro_code,
              unit: hd.pro1_unit,
              quantity: Number(hd.pro1_amount),
            },
          ];

          const hotdealRequiredInSmallest =
            await this.productsService.calculateSmallestUnit(
              hotdealRequirement,
            );
          if (hotdealRequiredInSmallest <= 0) {
            continue;
          }

          const totalFreebies = Math.floor(
            totalCartInSmallest / hotdealRequiredInSmallest,
          );

          if (totalFreebies > 0) {
            freebiesData.push({
              pro_code: hd.product2.pro_code,
              unit: hd.pro2_unit,
              quantity: totalFreebies,
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

      const validFreebieProCodes = new Set(freebiesData.map((f) => f.pro_code));

      const freebiesToRemove = allFreebiesInCart.filter(
        (fb) => !validFreebieProCodes.has(fb.pro_code),
      );
      if (freebiesToRemove.length > 0) {
        await this.shoppingCartRepo.remove(freebiesToRemove);
      }

      for (const freebieData of freebiesData) {
        const existingFreebie = allFreebiesInCart.find(
          (fb) => fb.pro_code === freebieData.pro_code,
        );

        if (existingFreebie) {
          if (Number(existingFreebie.spc_amount) !== freebieData.quantity) {
            await this.shoppingCartRepo.update(
              { spc_id: existingFreebie.spc_id },
              { spc_amount: freebieData.quantity },
            );
          }
        } else {
          // เพิ่มของแถมใหม่
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
              },
            },
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

  async getOrderFromCartMember(
    mem_code: string,
    pro_code: string,
  ): Promise<{ pro_code: string; spc_amount: number; spc_unit: string }[]> {
    try {
      const cartItems = await this.shoppingCartRepo.find({
        where: {
          mem_code: mem_code,
          pro_code: pro_code,
          spc_checked: true,
        },
        select: {
          pro_code: true,
          spc_amount: true,
          spc_unit: true,
        },
      });
      return cartItems;
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
          continue;
        }

        // เช็คจำนวนสินค้าหลักในตะกร้าเพื่อคำนวณแต้ม (หน่วยที่เล็กที่สุด)
        const mainProductInCart = await this.shoppingCartRepo.find({
          where: {
            mem_code,
            pro_code: data.pro_code1, // สินค้าหลักที่ต้องซื้อ
            hotdeal_free: false,
            spc_checked: true,
          },
        });

        if (mainProductInCart.length === 0) {
          continue;
        }

        // เช็คว่าครบเงื่อนไข hotdeal หรือไม่
        const hotdealMatch = await this.hotdealService.checkHotdealMatch(
          data.pro_code1,
          mainProductInCart.map((item) => ({
            pro1_unit: item.spc_unit,
            pro1_amount: item.spc_amount.toString(),
          })),
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

        // ถ้าครบเงื่อนไขแล้ว จึงเพิ่มหรืออัปเดตของแถม
        const existingFreebie = await this.shoppingCartRepo.findOne({
          where: {
            mem_code,
            pro_code: data.pro_code,
            hotdeal_promain: data.pro_code1,
            hotdeal_free: true,
          },
        });

        const actualFreebieAmount = Math.min(
          data.amount,
          Number(hotdealMatch.countFreeBies) || 0,
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
          const hotdeal = this.shoppingCartRepo.create({
            pro_code: data.pro_code,
            mem_code,
            spc_unit: data.unit,
            spc_amount: actualFreebieAmount,
            hotdeal_promain: data.pro_code1,
            spc_checked: true,
            hotdeal_free: true,
            spc_datetime: new Date(),
          });

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
      const hotdeals = await this.hotdealService.getHotdealByProCode([
        pro_code,
      ]);
      if (!hotdeals || hotdeals.length === 0) {
        return 0;
      }

      let totalUsedPoints = 0;

      // คำนวณแต้มที่ใช้สำหรับแต่ละของแถม
      for (const freebie of freebies) {
        // หา hotdeal rule ที่ตรงกับของแถมนี้
        const matchingHotdeal = hotdeals.find(
          (hd) =>
            hd.product2?.pro_code === freebie.pro_code &&
            hd.pro2_unit === freebie.spc_unit,
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
            await this.productsService.calculateSmallestUnit(requiredItems);

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
        relations: { product: true },
      });

      if (mainProductsInCart.length === 0) {
        return 0;
      }

      // คำนวณแต้มรวมของสินค้าหลัก (หน่วยเล็กสุด)
      const cartItems = mainProductsInCart.map((item) => ({
        pro_code: item.pro_code,
        unit: item.spc_unit,
        quantity: Number(item.spc_amount),
      }));

      const totalPoints =
        await this.productsService.calculateSmallestUnit(cartItems);
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
