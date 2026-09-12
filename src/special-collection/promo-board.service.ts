import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PromotionEntity } from '../promotion/promotion.entity';
import { PromotionTierEntity } from '../promotion/promotion-tier.entity';
import { PromotionConditionEntity } from '../promotion/promotion-condition.entity';
import { PromotionRewardEntity } from '../promotion/promotion-reward.entity';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import type { PriceOption } from '../bundle-set/bundle-set.service';
import {
  allocateTierSets,
  totalTierSets,
} from '../promotion/tier-allocation';
import { promoUnitPrice } from '../promotion/promo-line-value';

export interface BoardReward {
  reward_id: number;
  pro_code: string;
  pro_name: string;
  pro_imgmain: string | null;
  /** จำนวนต่อ 1 ชุด ตามที่แอดมินตั้งไว้ */
  qty: number;
  /** จำนวนที่ได้จริง = qty x จำนวนชุดที่ยอดถึง (0 เมื่อยังไม่ได้) */
  total_qty: number;
  /** แปลงจาก level index ใน promotion_reward.unit เป็นชื่อหน่วยจริงแล้ว */
  unit_name: string;
}

export interface BoardTier {
  tier_id: number;
  tier_name: string;
  tier_postter: string | null;
  description: string | null;
  /** true = นับเป็นจำนวนหน่วย, false = นับเป็นบาท */
  is_unit: boolean;
  /** true = นับสินค้าทั้งร้าน ไม่ใช่เฉพาะที่ร่วมรายการ */
  all_products: boolean;
  threshold: number;
  /** ยอดปัจจุบันของลูกค้าที่นับเข้าเงื่อนไขนี้ */
  progress: number;
  reached: boolean;
  /**
   * ได้ของแถมกี่ชุดจริง — ยอด 3 เท่าของเกณฑ์ = 3 ชุด
   * 0 ทั้งที่ reached = true แปลว่ายอดถูกขั้นที่ใหญ่กว่ากินไปหมดแล้ว
   */
  multiplier: number;
  /** เหลืออีกเท่าไหร่ถึงจะได้ — 0 เมื่อครบแล้ว */
  gap: number;
  rewards: BoardReward[];
}

export interface BoardProduct {
  pro_code: string;
  pro_name: string;
  pro_imgmain: string | null;
  /** ราคาต่อหน่วยเล็กสุด — ราคาของหน่วยอื่นอยู่ใน units[].price */
  price: number;
  pro_stock: number;
  units: Array<{
    level: number;
    unit_name: string;
    ratio: number;
    /** ราคาต่อ 1 หน่วยนี้ = ราคาหน่วยเล็กสุด x ratio */
    price: number;
  }>;
  /** จำนวนที่ลูกค้ามีอยู่ในตะกร้าแล้ว (หน่วยเล็กสุด) */
  in_cart_units: number;
}

export interface PromoBoard {
  promo_id: number;
  promo_name: string;
  promo_poster: string | null;
  start_date: Date;
  end_date: Date;
  /** true = ทุก tier นับสินค้าทั้งร้าน ไม่ต้องโชว์รายการสินค้า */
  all_products: boolean;
  tiers: BoardTier[];
  /** สินค้าที่ร่วมรายการ — dedupe แล้ว (ของเดิมเก็บซ้ำทุก tier) */
  products: BoardProduct[];
  summary: {
    /** ยอดรวมของสินค้าที่ร่วมรายการในตะกร้า (บาท) */
    amount: number;
    /** จำนวนหน่วยรวมของสินค้าที่ร่วมรายการในตะกร้า */
    units: number;
    reached_count: number;
    /** จำนวนชุดของแถมที่ได้รวมทุกขั้น — ตัวเลขที่ลูกค้าสนใจจริง */
    reward_sets: number;
    /** จำนวนชิ้นของแถมรวมทุกขั้น */
    reward_items: number;
    /** ขั้นถัดไปที่ยังไม่ถึง — null เมื่อได้ครบทุกขั้นแล้ว */
    next_tier: { tier_id: number; tier_name: string; gap: number } | null;
  };
}

/** 1 บรรทัดในกระเช้าที่ลูกค้ากำลังประกอบ ยังไม่ได้ใส่ตะกร้า */
export interface DraftLineInput {
  pro_code: string;
  unit_level: number;
  qty: number;
}

/**
 * ของแถมที่กระเช้าชุดนี้จะได้ ถ้าใส่ตะกร้าตามที่เลือกไว้ตอนนี้
 * หน้าบ้านเคยคำนวณเองแล้วได้ไม่ตรงกับ engine (นับได้ขั้นละ 1 ชุดเสมอ) — ECWC-496
 */
export interface BoardPreview {
  amount: number;
  units: number;
  tiers: BoardTier[];
  reward_sets: number;
  reward_items: number;
}

@Injectable()
export class PromoBoardService {
  private readonly logger = new Logger(PromoBoardService.name);

  constructor(
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly tierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly conditionRepo: Repository<PromotionConditionEntity>,
    @InjectRepository(PromotionRewardEntity)
    private readonly rewardRepo: Repository<PromotionRewardEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductUnitEntity)
    private readonly unitRepo: Repository<ProductUnitEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly cartRepo: Repository<ShoppingCartEntity>,
  ) {}

  private priceOf(product: ProductEntity, option: PriceOption): number {
    if (option === 'A') return Number(product.pro_priceA);
    if (option === 'B') return Number(product.pro_priceB);
    return Number(product.pro_priceC);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  async getBoard(
    promoId: number,
    memCode: string,
    option: PriceOption,
  ): Promise<PromoBoard> {
    const promotion = await this.promotionRepo.findOne({
      where: { promo_id: promoId },
    });
    if (!promotion) {
      throw new NotFoundException(`ไม่พบโปรโมชั่นรหัส ${promoId}`);
    }

    const tiers = await this.tierRepo.find({
      where: { promotion: { promo_id: promoId } },
      order: { min_amount: 'ASC' },
    });
    if (tiers.length === 0) {
      throw new NotFoundException(`โปรโมชั่นรหัส ${promoId} ยังไม่มีเงื่อนไข`);
    }

    const tierIds = tiers.map((tier) => tier.tier_id);
    const allProducts = tiers.every((tier) => tier.all_products);

    const [conditions, rewards] = await Promise.all([
      allProducts
        ? Promise.resolve([] as PromotionConditionEntity[])
        : this.conditionRepo.find({
            where: { tier: { tier_id: In(tierIds) } },
            // ต้องโหลด product ด้วย ไม่งั้น cond.product เป็น undefined
            // แล้วรายการสินค้าร่วมรายการจะว่างทั้งหมด
            relations: ['tier', 'product'],
          }),
      this.rewardRepo.find({
        where: { tier: { tier_id: In(tierIds) } },
        relations: ['tier', 'giftProduct'],
      }),
    ]);

    // ของเดิมเก็บ product list ซ้ำทุก tier — รวมเป็นชุดเดียวตามที่หน้าบ้านต้องใช้
    const participatingCodes = Array.from(
      new Set(conditions.map((cond) => cond.product?.pro_code).filter(Boolean)),
    );

    const rewardCodes = Array.from(
      new Set(
        rewards.map((reward) => reward.giftProduct?.pro_code).filter(Boolean),
      ),
    );

    const [products, units, cartRows] = await Promise.all([
      participatingCodes.length + rewardCodes.length > 0
        ? this.productRepo.find({
            where: { pro_code: In([...participatingCodes, ...rewardCodes]) },
          })
        : Promise.resolve([] as ProductEntity[]),
      participatingCodes.length + rewardCodes.length > 0
        ? this.unitRepo.find({
            where: { pro_code: In([...participatingCodes, ...rewardCodes]) },
          })
        : Promise.resolve([] as ProductUnitEntity[]),
      this.cartRepo.find({
        where: { mem_code: memCode, spc_checked: true, is_reward: false },
        relations: ['product'],
      }),
    ]);

    const productMap = new Map(products.map((row) => [row.pro_code, row]));
    const unitsByCode = new Map<string, ProductUnitEntity[]>();
    units.forEach((unit) => {
      unitsByCode.set(unit.pro_code, [
        ...(unitsByCode.get(unit.pro_code) ?? []),
        unit,
      ]);
    });

    const ratioOf = (proCode: string, level: number): number =>
      Number(
        unitsByCode.get(proCode)?.find((unit) => unit.level === level)?.ratio,
      ) || 1;

    // ---- ยอดปัจจุบันของลูกค้า ----
    const month = new Date().getMonth() + 1;

    // ราคาโปรเดือนคิดจากยอดรวมของสินค้าตัวนั้นทั้งตะกร้า ไม่ใช่ทีละบรรทัด
    // ต้องนับให้ครบก่อนถึงจะตีราคาได้ เหมือนที่ checkPromotionReward ทำ
    const perProductUnits = new Map<string, number>();
    for (const line of cartRows) {
      if (line.hotdeal_free) continue;
      if (Number(line.spc_fixed_total) === 0) continue;
      const ratio = ratioOf(line.pro_code, Number(line.spc_unit_enum ?? 1));
      perProductUnits.set(
        line.pro_code,
        (perProductUnits.get(line.pro_code) ?? 0) +
          Number(line.spc_amount) * ratio,
      );
    }

    const countsFor = (codes: Set<string> | null) => {
      let amount = 0;
      let unitCount = 0;
      for (const line of cartRows) {
        if (line.hotdeal_free) continue;
        if (codes && !codes.has(line.pro_code)) continue;
        const product = line.product ?? productMap.get(line.pro_code);
        if (!product) continue;
        const fixed =
          line.spc_fixed_total === null || line.spc_fixed_total === undefined
            ? null
            : Number(line.spc_fixed_total);
        // ของแถมในกระเช้าสำเร็จรูปไม่นับ ส่วนที่จ่ายจริงนับที่ราคาชุด
        if (fixed === 0) continue;
        const ratio = ratioOf(line.pro_code, Number(line.spc_unit_enum ?? 1));
        const qty = Number(line.spc_amount) * ratio;
        unitCount += qty;
        amount +=
          fixed ??
          qty *
            promoUnitPrice(
              product,
              option,
              perProductUnits.get(line.pro_code) ?? 0,
              month,
            );
      }
      return { amount: this.round2(amount), units: unitCount };
    };

    const participatingSet = new Set(participatingCodes);
    const scoped = countsFor(allProducts ? null : participatingSet);

    // ---- ประกอบ tier ----
    const rewardsByTier = this.buildRewardsByTier(rewards, unitsByCode);

    const storeWide = countsFor(null);
    const { boardTiers, setsByTier } = this.assembleTiers(
      tiers,
      rewardsByTier,
      scoped,
      storeWide,
    );

    // ---- สินค้าที่ร่วมรายการ (คอลัมน์ "ซื้ออะไร") ----
    const inCartUnits = new Map<string, number>();
    for (const line of cartRows) {
      if (line.hotdeal_free) continue;
      const ratio = ratioOf(line.pro_code, Number(line.spc_unit_enum ?? 1));
      inCartUnits.set(
        line.pro_code,
        (inCartUnits.get(line.pro_code) ?? 0) + Number(line.spc_amount) * ratio,
      );
    }

    const boardProducts: BoardProduct[] = participatingCodes
      .map((code) => productMap.get(code))
      .filter((product): product is ProductEntity => Boolean(product))
      .map((product) => {
        const basePrice = this.priceOf(product, option);
        return {
          pro_code: product.pro_code,
          pro_name: product.pro_name,
          pro_imgmain: product.pro_imgmain ?? null,
          price: basePrice,
          pro_stock: Number(product.pro_stock ?? 0),
          units: (unitsByCode.get(product.pro_code) ?? [])
            .slice()
            .sort((a, b) => a.level - b.level)
            .map((unit) => {
              const ratio = Number(unit.ratio) || 1;
              return {
                level: unit.level,
                unit_name: unit.unit_name,
                ratio,
                price: this.round2(basePrice * ratio),
              };
            }),
          in_cart_units: inCartUnits.get(product.pro_code) ?? 0,
        };
      })
      .sort((a, b) => a.pro_name.localeCompare(b.pro_name, 'th'));

    const notReached = boardTiers.filter((tier) => !tier.reached);
    const nextTier = notReached.length > 0 ? notReached[0] : null;

    return {
      promo_id: promotion.promo_id,
      promo_name: promotion.promo_name,
      promo_poster: promotion.promo_poster ?? null,
      start_date: promotion.start_date,
      end_date: promotion.end_date,
      all_products: allProducts,
      tiers: boardTiers,
      products: boardProducts,
      summary: {
        amount: scoped.amount,
        units: scoped.units,
        reached_count: boardTiers.filter((tier) => tier.reached).length,
        reward_sets: totalTierSets(setsByTier),
        reward_items: boardTiers.reduce(
          (sum, tier) =>
            sum +
            tier.rewards.reduce((inner, reward) => inner + reward.total_qty, 0),
          0,
        ),
        next_tier: nextTier
          ? {
              tier_id: nextTier.tier_id,
              tier_name: nextTier.tier_name,
              gap: nextTier.gap,
            }
          : null,
      },
    };
  }

  /**
   * ประกอบขั้นของโปรพร้อมจำนวนชุดที่ได้จริง — ใช้ทั้งหน้าบอร์ด (ยอดในตะกร้า)
   * และหน้าพรีวิวกระเช้าที่ยังไม่ได้ใส่ตะกร้า จะได้ตอบตัวเลขเดียวกันเสมอ
   */
  private assembleTiers(
    tiers: PromotionTierEntity[],
    rewardsByTier: Map<number, BoardReward[]>,
    scoped: { amount: number; units: number },
    storeWide: { amount: number; units: number },
    /** true = ยอดเดียวใช้กับทุกขั้น (พรีวิวกระเช้า ไม่มีของอื่นในถัง) */
    singlePool = false,
  ): { boardTiers: BoardTier[]; setsByTier: Map<number, number> } {
    const describe = (tier: PromotionTierEntity) => ({
      tier_id: tier.tier_id,
      threshold: Number(tier.min_amount),
      is_unit: Boolean(tier.is_unit),
    });

    const setsByTier = new Map<number, number>();
    if (singlePool) {
      // ขั้นทั้งหมดแย่งยอดก้อนเดียวกัน ขั้นใหญ่กินก่อนเหมือน engine
      for (const [tierId, sets] of allocateTierSets(
        tiers.map(describe),
        scoped,
      )) {
        setsByTier.set(tierId, sets);
      }
    } else {
      // ขั้นที่นับทั้งร้านใช้ยอดคนละถังกับขั้นที่นับเฉพาะสินค้าร่วมรายการ
      // แบ่งชุดของแถมแยกถังกัน แล้วค่อยประกอบกลับเป็นรายการเดียว
      for (const [allProducts, pool] of [
        [false, scoped],
        [true, storeWide],
      ] as const) {
        const group = tiers
          .filter((tier) => Boolean(tier.all_products) === allProducts)
          .map(describe);
        if (group.length === 0) continue;
        for (const [tierId, sets] of allocateTierSets(group, pool)) {
          setsByTier.set(tierId, sets);
        }
      }
    }

    const boardTiers: BoardTier[] = tiers.map((tier) => {
      const threshold = Number(tier.min_amount);
      // tier ที่นับทั้งร้านใช้ยอดทั้งตะกร้า ไม่ใช่เฉพาะสินค้าร่วมรายการ
      const source = tier.all_products ? storeWide : scoped;
      const progress = tier.is_unit ? source.units : source.amount;
      const reached = progress >= threshold;
      const multiplier = setsByTier.get(tier.tier_id) ?? 0;
      return {
        tier_id: tier.tier_id,
        tier_name: tier.tier_name,
        tier_postter: tier.tier_postter ?? null,
        description: tier.description ?? null,
        is_unit: Boolean(tier.is_unit),
        all_products: Boolean(tier.all_products),
        threshold,
        progress: this.round2(progress),
        reached,
        multiplier,
        gap: reached ? 0 : this.round2(threshold - progress),
        rewards: (rewardsByTier.get(tier.tier_id) ?? []).map((reward) => ({
          ...reward,
          total_qty: reward.qty * multiplier,
        })),
      };
    });

    return { boardTiers, setsByTier };
  }


  /** ของแถมต่อขั้น พร้อมแปลง level ใน promotion_reward.unit เป็นชื่อหน่วยจริง */
  private buildRewardsByTier(
    rewards: PromotionRewardEntity[],
    unitsByCode: Map<string, ProductUnitEntity[]>,
  ): Map<number, BoardReward[]> {
    const rewardsByTier = new Map<number, BoardReward[]>();
    for (const reward of rewards) {
      const gift = reward.giftProduct;
      if (!gift) continue;
      const level = Number(reward.unit);
      const unitName =
        unitsByCode.get(gift.pro_code)?.find((u) => u.level === level)
          ?.unit_name ??
        // ค่าที่เก็บอาจเป็นชื่อหน่วยอยู่แล้วในข้อมูลเก่า
        (Number.isFinite(level) ? '' : reward.unit);

      const tierId = reward.tier.tier_id;
      rewardsByTier.set(tierId, [
        ...(rewardsByTier.get(tierId) ?? []),
        {
          reward_id: reward.reward_id,
          pro_code: gift.pro_code,
          pro_name: gift.pro_name,
          pro_imgmain: gift.pro_imgmain ?? null,
          qty: reward.qty,
          total_qty: 0,
          unit_name: unitName,
        },
      ]);
    }
    return rewardsByTier;
  }


  /**
   * ตีราคากระเช้าที่ยังไม่ได้ใส่ตะกร้า แล้วบอกว่าจะได้ของแถมกี่ชุด
   * คิดด้วยกติกาเดียวกับ checkPromotionReward ทุกประการ หน้าบ้านจึงไม่ต้องคิดเอง
   */
  async previewDraft(
    promoId: number,
    option: PriceOption,
    lines: DraftLineInput[],
  ): Promise<BoardPreview> {
    const tiers = await this.tierRepo.find({
      where: { promotion: { promo_id: promoId } },
      order: { min_amount: 'ASC' },
    });
    if (tiers.length === 0) {
      throw new NotFoundException(`โปรโมชั่นรหัส ${promoId} ยังไม่มีเงื่อนไข`);
    }

    const tierIds = tiers.map((tier) => tier.tier_id);
    const rewards = await this.rewardRepo.find({
      where: { tier: { tier_id: In(tierIds) } },
      relations: ['tier', 'giftProduct'],
    });

    const wanted = (lines ?? []).filter(
      (line) => line && line.pro_code && Number(line.qty) > 0,
    );
    const codes = Array.from(
      new Set([
        ...wanted.map((line) => line.pro_code),
        ...rewards
          .map((reward) => reward.giftProduct?.pro_code)
          .filter((code): code is string => Boolean(code)),
      ]),
    );

    const [products, units] = await Promise.all([
      codes.length > 0
        ? this.productRepo.find({ where: { pro_code: In(codes) } })
        : Promise.resolve([] as ProductEntity[]),
      codes.length > 0
        ? this.unitRepo.find({ where: { pro_code: In(codes) } })
        : Promise.resolve([] as ProductUnitEntity[]),
    ]);

    const productMap = new Map(products.map((row) => [row.pro_code, row]));
    const unitsByCode = new Map<string, ProductUnitEntity[]>();
    units.forEach((unit) => {
      unitsByCode.set(unit.pro_code, [
        ...(unitsByCode.get(unit.pro_code) ?? []),
        unit,
      ]);
    });
    const ratioOf = (proCode: string, level: number): number =>
      Number(
        unitsByCode.get(proCode)?.find((unit) => unit.level === level)?.ratio,
      ) || 1;

    // ราคาโปรเดือนดูจากยอดรวมของสินค้าตัวนั้นทั้งกระเช้า ไม่ใช่ทีละบรรทัด
    const perProductUnits = new Map<string, number>();
    for (const line of wanted) {
      const ratio = ratioOf(line.pro_code, Number(line.unit_level));
      perProductUnits.set(
        line.pro_code,
        (perProductUnits.get(line.pro_code) ?? 0) + ratio * Number(line.qty),
      );
    }

    const month = new Date().getMonth() + 1;
    let amount = 0;
    let unitCount = 0;
    for (const line of wanted) {
      const product = productMap.get(line.pro_code);
      if (!product) continue;
      const ratio = ratioOf(line.pro_code, Number(line.unit_level));
      const qty = ratio * Number(line.qty);
      unitCount += qty;
      amount +=
        qty *
        promoUnitPrice(
          product,
          option,
          perProductUnits.get(line.pro_code) ?? 0,
          month,
        );
    }

    const pool = { amount: this.round2(amount), units: unitCount };
    const { boardTiers, setsByTier } = this.assembleTiers(
      tiers,
      this.buildRewardsByTier(rewards, unitsByCode),
      pool,
      pool,
      true,
    );

    return {
      amount: pool.amount,
      units: pool.units,
      tiers: boardTiers,
      reward_sets: totalTierSets(setsByTier),
      reward_items: boardTiers.reduce(
        (sum, tier) =>
          sum +
          tier.rewards.reduce((inner, reward) => inner + reward.total_qty, 0),
        0,
      ),
    };
  }

}
