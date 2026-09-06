import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CartBasketEntity } from './cart-basket.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { PromotionEntity } from '../promotion/promotion.entity';
import { PromotionTierEntity } from '../promotion/promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';
import type { PriceOption } from '../bundle-set/bundle-set.service';

export interface BasketLineInput {
  pro_code: string;
  unit_level: number;
  qty: number;
}

export interface BasketLineView {
  spc_id: number;
  pro_code: string;
  pro_name: string;
  pro_imgmain: string | null;
  unit_name: string;
  unit_level: number;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface BasketView {
  basket_id: number;
  promo_id: number;
  promo_name: string;
  lines: BasketLineView[];
  total_amount: number;
  total_units: number;
  /** เกณฑ์ต่ำสุดของโปร — ต่ำกว่านี้กระเช้าไม่ได้ของแถมอะไรเลย */
  min_threshold: number;
  min_is_unit: boolean;
  qualifies: boolean;
  reached_tier_count: number;
}

@Injectable()
export class CartBasketService {
  private readonly logger = new Logger(CartBasketService.name);

  constructor(
    @InjectRepository(CartBasketEntity)
    private readonly basketRepo: Repository<CartBasketEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly cartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly tierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductUnitEntity)
    private readonly unitRepo: Repository<ProductUnitEntity>,
    private readonly dataSource: DataSource,
    private readonly shoppingCartService: ShoppingCartService,
  ) {}

  private priceOf(product: ProductEntity, option: PriceOption): number {
    if (option === 'A') return Number(product.pro_priceA);
    if (option === 'B') return Number(product.pro_priceB);
    return Number(product.pro_priceC);
  }

  private round2(value: number): number {
    return Math.round(value * 100) / 100;
  }

  /** ขั้นต่ำสุดของโปร ใช้ตัดสินว่ากระเช้ายัง "มีความหมาย" อยู่ไหม */
  private async lowestTier(promoId: number): Promise<{
    threshold: number;
    is_unit: boolean;
    tiers: PromotionTierEntity[];
  }> {
    const tiers = await this.tierRepo.find({
      where: { promotion: { promo_id: promoId } },
      order: { min_amount: 'ASC' },
    });
    if (tiers.length === 0) {
      throw new NotFoundException(`โปรโมชั่นรหัส ${promoId} ยังไม่มีเงื่อนไข`);
    }
    return {
      threshold: Number(tiers[0].min_amount),
      is_unit: Boolean(tiers[0].is_unit),
      tiers,
    };
  }

  // ------------------------------------------------------------------ create

  async createBasket(
    memCode: string,
    promoId: number,
    lines: BasketLineInput[],
    option: PriceOption,
  ): Promise<{ basket_id: number }> {
    if (!lines || lines.length === 0) {
      throw new BadRequestException('กระเช้าต้องมีสินค้าอย่างน้อย 1 รายการ');
    }

    const promotion = await this.promotionRepo.findOne({
      where: { promo_id: promoId },
    });
    if (!promotion) {
      throw new NotFoundException(`ไม่พบโปรโมชั่นรหัส ${promoId}`);
    }

    const codes = Array.from(new Set(lines.map((line) => line.pro_code)));
    const [products, units] = await Promise.all([
      this.productRepo.find({ where: { pro_code: In(codes) } }),
      this.unitRepo.find({ where: { pro_code: In(codes) } }),
    ]);
    const productMap = new Map(products.map((row) => [row.pro_code, row]));

    for (const line of lines) {
      if (!productMap.has(line.pro_code)) {
        throw new NotFoundException(`ไม่พบสินค้ารหัส ${line.pro_code}`);
      }
      const hasUnit = units.some(
        (unit) =>
          unit.pro_code === line.pro_code && unit.level === line.unit_level,
      );
      if (!hasUnit) {
        throw new BadRequestException(
          `สินค้า ${line.pro_code} ไม่มีหน่วยระดับ ${line.unit_level}`,
        );
      }
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        throw new BadRequestException(
          `จำนวนของ ${line.pro_code} ต้องมากกว่า 0`,
        );
      }
    }

    // รวมจำนวนต่อสินค้าก่อนเทียบสต็อก — สินค้าเดียวกันอาจถูกเลือกหลายหน่วยในกระเช้าเดียว
    const neededUnits = new Map<string, number>();
    for (const line of lines) {
      const ratio =
        Number(
          units.find(
            (u) => u.pro_code === line.pro_code && u.level === line.unit_level,
          )?.ratio,
        ) || 1;
      neededUnits.set(
        line.pro_code,
        (neededUnits.get(line.pro_code) ?? 0) + ratio * line.qty,
      );
    }
    for (const [proCode, needed] of neededUnits) {
      const stock = Number(
        (productMap.get(proCode) as ProductEntity).pro_stock ?? 0,
      );
      if (needed > stock) {
        throw new ConflictException(
          `${proCode} มีไม่พอ (ต้องการ ${needed} มีอยู่ ${stock})`,
        );
      }
    }

    // ตรวจว่ากระเช้าถึงเกณฑ์ก่อนบันทึก — ไม่ให้สร้างกระเช้าที่ไม่ได้อะไรเลย
    const { threshold, is_unit } = await this.lowestTier(promoId);
    let amount = 0;
    let unitCount = 0;
    for (const line of lines) {
      const product = productMap.get(line.pro_code) as ProductEntity;
      const ratio =
        Number(
          units.find(
            (u) => u.pro_code === line.pro_code && u.level === line.unit_level,
          )?.ratio,
        ) || 1;
      amount += this.priceOf(product, option) * ratio * line.qty;
      unitCount += ratio * line.qty;
    }
    const progress = is_unit ? unitCount : this.round2(amount);
    if (progress < threshold) {
      throw new ConflictException(
        `ยอดกระเช้ายังไม่ถึงเกณฑ์ขั้นต่ำ (${threshold})`,
      );
    }

    const created = await this.dataSource.transaction(async (manager) => {
      const basket = await manager.save(
        manager.create(CartBasketEntity, {
          mem_code: memCode,
          promo_id: promoId,
        }),
      );

      // แถวของกระเช้าเป็นแถวแยกเสมอ ไม่รวมกับสินค้าเดี่ยวที่อยู่ในตะกร้าอยู่แล้ว
      // ไม่งั้นเอากระเช้าออกจะไปลบของที่ลูกค้าเลือกไว้เองด้วย
      await manager.save(
        lines.map((line) =>
          manager.create(ShoppingCartEntity, {
            mem_code: memCode,
            pro_code: line.pro_code,
            spc_amount: line.qty,
            spc_unit_enum: String(line.unit_level) as '1' | '2' | '3',
            spc_checked: true,
            is_reward: false,
            hotdeal_free: false,
            promo_id: promoId,
            basket_id: basket.basket_id,
            spc_datetime: new Date(),
          }),
        ),
      );

      this.logger.log(
        `created cart basket ${basket.basket_id} for ${memCode} promo ${promoId}`,
      );
      return { basket_id: basket.basket_id };
    });

    // แถวของกระเช้าเป็นสินค้าในตะกร้าจริง engine ของแถมต้องคิดใหม่ทันที
    // ไม่งั้นของแถมจะโผล่/หายก็ต่อเมื่อลูกค้าแตะตะกร้าครั้งถัดไป
    await this.shoppingCartService.checkPromotionReward(memCode, option);
    return created;
  }

  // -------------------------------------------------------------------- read

  async listBaskets(
    memCode: string,
    option: PriceOption,
    promoId?: number,
  ): Promise<BasketView[]> {
    const baskets = await this.basketRepo.find({
      where: promoId
        ? { mem_code: memCode, promo_id: promoId }
        : { mem_code: memCode },
      order: { created_at: 'ASC' },
    });
    if (baskets.length === 0) return [];

    const basketIds = baskets.map((basket) => basket.basket_id);
    const rows = await this.cartRepo.find({
      where: { basket_id: In(basketIds) },
      relations: ['product'],
    });

    const codes = Array.from(new Set(rows.map((row) => row.pro_code)));
    const [promotions, units] = await Promise.all([
      this.promotionRepo.find({
        where: { promo_id: In(baskets.map((b) => b.promo_id)) },
      }),
      codes.length > 0
        ? this.unitRepo.find({ where: { pro_code: In(codes) } })
        : Promise.resolve([] as ProductUnitEntity[]),
    ]);
    const promoMap = new Map(promotions.map((p) => [p.promo_id, p]));

    const unitOf = (proCode: string, level: number) =>
      units.find((u) => u.pro_code === proCode && u.level === level);

    const views: BasketView[] = [];
    for (const basket of baskets) {
      const basketRows = rows.filter(
        (row) => row.basket_id === basket.basket_id,
      );
      const { threshold, is_unit, tiers } = await this.lowestTier(
        basket.promo_id,
      );

      let amount = 0;
      let unitCount = 0;
      const lines: BasketLineView[] = basketRows.map((row) => {
        const level = Number(row.spc_unit_enum ?? 1);
        const unit = unitOf(row.pro_code, level);
        const ratio = Number(unit?.ratio) || 1;
        const base = row.product ? this.priceOf(row.product, option) : 0;
        const unitPrice = this.round2(base * ratio);
        const qty = Number(row.spc_amount);
        amount += unitPrice * qty;
        unitCount += ratio * qty;
        return {
          spc_id: row.spc_id,
          pro_code: row.pro_code,
          pro_name: row.product?.pro_name ?? row.pro_code,
          pro_imgmain: row.product?.pro_imgmain ?? null,
          unit_name: unit?.unit_name ?? '',
          unit_level: level,
          qty,
          unit_price: unitPrice,
          line_total: this.round2(unitPrice * qty),
        };
      });

      const progress = is_unit ? unitCount : this.round2(amount);
      views.push({
        basket_id: basket.basket_id,
        promo_id: basket.promo_id,
        promo_name: promoMap.get(basket.promo_id)?.promo_name ?? '',
        lines,
        total_amount: this.round2(amount),
        total_units: unitCount,
        min_threshold: threshold,
        min_is_unit: is_unit,
        qualifies: progress >= threshold,
        reached_tier_count: tiers.filter(
          (tier) =>
            (tier.is_unit ? unitCount : amount) >= Number(tier.min_amount),
        ).length,
      });
    }
    return views;
  }

  // ------------------------------------------------------------------ mutate

  private async findBasketOrFail(
    memCode: string,
    basketId: number,
  ): Promise<CartBasketEntity> {
    const basket = await this.basketRepo.findOne({
      where: { basket_id: basketId, mem_code: memCode },
    });
    if (!basket) {
      throw new NotFoundException(`ไม่พบกระเช้ารหัส ${basketId}`);
    }
    return basket;
  }

  /**
   * เอาสินค้าออก 1 รายการ
   * ถ้าเอาออกแล้วยอดต่ำกว่าเกณฑ์ จะไม่ยอมลบ แต่คืนข้อมูลให้หน้าบ้านถามยืนยัน
   * ก่อนเรียกซ้ำด้วย remove_whole_basket = true
   */
  async removeLine(
    memCode: string,
    basketId: number,
    spcId: number,
    removeWholeBasket: boolean,
    option: PriceOption,
  ): Promise<
    | { removed: 'line' }
    | { removed: 'basket' }
    | {
        removed: 'none';
        needs_confirm: true;
        remaining: number;
        threshold: number;
        is_unit: boolean;
      }
  > {
    const basket = await this.findBasketOrFail(memCode, basketId);
    const rows = await this.cartRepo.find({
      where: { basket_id: basketId },
      relations: ['product'],
    });
    const target = rows.find((row) => row.spc_id === spcId);
    if (!target) {
      throw new NotFoundException(`ไม่พบรายการรหัส ${spcId} ในกระเช้านี้`);
    }

    const { threshold, is_unit } = await this.lowestTier(basket.promo_id);
    const codes = Array.from(new Set(rows.map((row) => row.pro_code)));
    const units = await this.unitRepo.find({ where: { pro_code: In(codes) } });

    const valueOf = (row: ShoppingCartEntity) => {
      const level = Number(row.spc_unit_enum ?? 1);
      const ratio =
        Number(
          units.find((u) => u.pro_code === row.pro_code && u.level === level)
            ?.ratio,
        ) || 1;
      const qty = Number(row.spc_amount);
      return {
        amount: row.product
          ? this.priceOf(row.product, option) * ratio * qty
          : 0,
        units: ratio * qty,
      };
    };

    const remainingRows = rows.filter((row) => row.spc_id !== spcId);
    const remaining = remainingRows.reduce(
      (acc, row) => {
        const value = valueOf(row);
        return {
          amount: acc.amount + value.amount,
          units: acc.units + value.units,
        };
      },
      { amount: 0, units: 0 },
    );
    const progress = is_unit ? remaining.units : this.round2(remaining.amount);

    // เอาออกแล้วยังถึงเกณฑ์ — ลบรายการเดียวพอ
    if (remainingRows.length > 0 && progress >= threshold) {
      await this.cartRepo.delete({ spc_id: spcId });
      await this.shoppingCartService.checkPromotionReward(memCode, option);
      return { removed: 'line' };
    }

    // ต่ำกว่าเกณฑ์ (หรือไม่เหลืออะไรเลย) — ต้องยกกระเช้าออกทั้งก้อน
    if (!removeWholeBasket) {
      return {
        removed: 'none',
        needs_confirm: true,
        remaining: progress,
        threshold,
        is_unit,
      };
    }

    await this.deleteBasket(memCode, basketId, option);
    return { removed: 'basket' };
  }

  async deleteBasket(
    memCode: string,
    basketId: number,
    option: PriceOption,
  ): Promise<{ deleted: boolean }> {
    await this.findBasketOrFail(memCode, basketId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ShoppingCartEntity, { basket_id: basketId });
      await manager.delete(CartBasketEntity, { basket_id: basketId });
    });
    await this.shoppingCartService.checkPromotionReward(memCode, option);
    this.logger.log(`deleted cart basket ${basketId} for ${memCode}`);
    return { deleted: true };
  }
}
