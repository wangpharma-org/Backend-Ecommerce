import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { HotdealEntity } from '../hotdeal/hotdeal.entity';
import { PromotionConditionEntity } from '../promotion/promotion-condition.entity';

// hotdeal ไม่มีวันหมดอายุ ถือว่า active ตลอด
const HOTDEAL_END = new Date('9999-12-31T23:59:59Z');

interface PairWindow {
  start: Date;
  end: Date;
}

interface PairConflict {
  source: string;
  buyCode: string;
  giftCode: string;
}

@Injectable()
export class PromoOverlapService {
  constructor(
    @InjectRepository(HotdealEntity)
    private readonly hotdealRepo: Repository<HotdealEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly conditionRepo: Repository<PromotionConditionEntity>,
  ) {}

  // Hotdeal ที่จะเพิ่ม ห้ามซ้ำคู่ ซื้อ A → แถม B กับ Company Day / Wang Day ที่ยัง active
  async assertHotdealPairAvailable(
    buyCode: string,
    giftCode: string,
  ): Promise<void> {
    const conflicts = await this.findPromotionConflicts({
      buyCodes: [buyCode],
      giftCodes: [giftCode],
      window: { start: new Date(), end: HOTDEAL_END },
    });
    this.throwIfConflict(conflicts);
  }

  // Company Day / Wang Day ห้ามซ้ำคู่ ซื้อ A → แถม B กับ Hotdeal หรือ promotion อื่นที่ช่วงเวลาซ้อนกัน
  async assertPromotionPairAvailable(data: {
    promo_id: number;
    start_date: Date;
    end_date: Date;
    buyCodes: string[];
    giftCodes: string[];
  }): Promise<void> {
    if (!data.buyCodes.length || !data.giftCodes.length) return;

    const window: PairWindow = { start: data.start_date, end: data.end_date };
    const [hotdealConflicts, promotionConflicts] = await Promise.all([
      // hotdeal active ตลอด จึงชนทุกครั้งที่ promotion ยังไม่หมดอายุ
      window.end >= new Date()
        ? this.findHotdealConflicts(data.buyCodes, data.giftCodes)
        : Promise.resolve([]),
      this.findPromotionConflicts({
        buyCodes: data.buyCodes,
        giftCodes: data.giftCodes,
        window,
        excludePromoId: data.promo_id,
      }),
    ]);
    this.throwIfConflict([...hotdealConflicts, ...promotionConflicts]);
  }

  private async findHotdealConflicts(
    buyCodes: string[],
    giftCodes: string[],
  ): Promise<PairConflict[]> {
    const hotdeals = await this.hotdealRepo.find({
      where: {
        product: { pro_code: In(buyCodes) },
        product2: { pro_code: In(giftCodes) },
      },
      relations: { product: true, product2: true },
      select: {
        id: true,
        product: { pro_code: true },
        product2: { pro_code: true },
      },
    });
    return hotdeals.map((h) => ({
      source: `Hotdeal ID ${h.id}`,
      buyCode: h.product.pro_code,
      giftCode: h.product2.pro_code,
    }));
  }

  private async findPromotionConflicts(data: {
    buyCodes: string[];
    giftCodes: string[];
    window: PairWindow;
    excludePromoId?: number;
  }): Promise<PairConflict[]> {
    const query = this.conditionRepo
      .createQueryBuilder('cond')
      .innerJoin('cond.tier', 'tier')
      .innerJoin('tier.promotion', 'promo')
      .innerJoin('tier.rewards', 'reward')
      .innerJoin('cond.product', 'buy')
      .innerJoin('reward.giftProduct', 'gift')
      .select('promo.promo_id', 'promo_id')
      .addSelect('promo.promo_name', 'promo_name')
      .addSelect('buy.pro_code', 'buy_code')
      .addSelect('gift.pro_code', 'gift_code')
      .where('buy.pro_code IN (:...buyCodes)', { buyCodes: data.buyCodes })
      .andWhere('gift.pro_code IN (:...giftCodes)', {
        giftCodes: data.giftCodes,
      })
      .andWhere('promo.status = true')
      .andWhere('promo.deleted_at IS NULL')
      .andWhere('tier.deleted_at IS NULL')
      .andWhere('promo.start_date <= :end', { end: data.window.end })
      .andWhere('promo.end_date >= :start', { start: data.window.start });

    if (data.excludePromoId !== undefined) {
      query.andWhere('promo.promo_id != :excludePromoId', {
        excludePromoId: data.excludePromoId,
      });
    }

    const rows = await query.getRawMany<{
      promo_id: number;
      promo_name: string;
      buy_code: string;
      gift_code: string;
    }>();
    return rows.map((r) => ({
      source: `โปรโมชัน "${r.promo_name}" (ID ${r.promo_id})`,
      buyCode: r.buy_code,
      giftCode: r.gift_code,
    }));
  }

  private throwIfConflict(conflicts: PairConflict[]): void {
    if (!conflicts.length) return;
    const details = conflicts
      .map((c) => `ซื้อ ${c.buyCode} แถม ${c.giftCode} อยู่ใน ${c.source}`)
      .join(', ');
    throw new ConflictException(
      `เงื่อนไขโปรโมชันทับกัน ไม่สามารถเพิ่มได้: ${details}`,
    );
  }
}
