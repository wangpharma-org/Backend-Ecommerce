import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { HappyHourService } from 'src/happy-hour/happy-hour.service';
import { RedeemProductSetService } from 'src/fix-free/redeem-product-set.service';
import { CheckoutPreviewInput } from './checkout-preview.input';

const round2 = (n: number) => Math.round(n * 100) / 100;

export type CheckoutGiftKind = 'promotion' | 'hotdeal' | 'happy_hour';

export interface CheckoutPreviewGift {
  kind: CheckoutGiftKind;
  pro_code: string;
  pro_name: string | null;
  unit: string;
  qty: number;
  image: string | null;
  promo_id?: number;
  promo_name?: string;
  tier_id?: number;
  tier_name?: string;
  main_pro_code?: string;
}

/**
 * หน้ากิมมิคหลังหน้า Key ขาย (ระบบขาย) — ของแถมอัตโนมัติ + แต้ม + ตรวจของแลกแต้ม ด้วยกติกาเดียวกับหน้าเว็บลูกค้า
 * ไม่แตะตะกร้าของลูกค้า และไม่บันทึกอะไร
 */
@Injectable()
export class CheckoutPreviewService {
  constructor(
    private readonly cart: ShoppingCartService,
    private readonly happyHour: HappyHourService,
    private readonly redeemSet: RedeemProductSetService,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async preview(input: CheckoutPreviewInput) {
    const base = await this.cart.previewCheckoutLines(
      input.mem_code,
      input.lines,
      {
        price_option: input.price_option,
        mem_route: input.mem_route,
      },
    );
    // แต้ม = ยอดตะกร้า × 1% มีทศนิยม (หน้า /list-free และ submit-order ใช้สูตรนี้)
    const points = round2(base.total * 0.01);

    const happy =
      base.total > 0
        ? await this.happyHour.getCartPreview({
            order_amount: base.total,
            cart_items: base.lines.map((l) => ({
              pro_code: l.pro_code,
              amount: l.amount,
            })),
          } as never)
        : { is_happy_hour: false };

    const giftCodes = [
      ...base.promo_gifts.map((g) => g.pro_code),
      ...base.hotdeal_gifts.map((g) => g.pro_code),
    ];
    const giftProducts = giftCodes.length
      ? await this.productRepo.find({
          where: { pro_code: In([...new Set(giftCodes)]) },
          relations: { units: true },
        })
      : [];
    const productBy = new Map(giftProducts.map((p) => [p.pro_code, p]));
    const unitName = (code: string, unit: string) => {
      const p = productBy.get(code);
      const u = p?.units?.find(
        (x) => String(x.level) === String(unit) || x.unit_name === unit,
      );
      return u?.unit_name?.trim() || unit;
    };
    const nameOf = (code: string) => {
      const p = productBy.get(code);
      return p ? p.pro_nameTH || p.pro_name || null : null;
    };
    const imageOf = (code: string) => productBy.get(code)?.pro_imgmain ?? null;
    const tierBy = new Map(base.reached_tiers.map((t) => [t.tier_id, t]));

    const gifts: CheckoutPreviewGift[] = [
      ...base.promo_gifts
        .filter((g) => g.qty > 0)
        .map((g) => ({
          kind: 'promotion' as const,
          pro_code: g.pro_code,
          pro_name: nameOf(g.pro_code),
          unit: unitName(g.pro_code, g.unit),
          qty: g.qty,
          image: imageOf(g.pro_code),
          promo_id: g.promo_id,
          promo_name: tierBy.get(g.tier_id)?.promo_name,
          tier_id: g.tier_id,
          tier_name: tierBy.get(g.tier_id)?.tier_name,
        })),
      ...base.hotdeal_gifts
        .filter((g) => g.qty > 0)
        .map((g) => ({
          kind: 'hotdeal' as const,
          pro_code: g.pro_code,
          pro_name: nameOf(g.pro_code),
          unit: unitName(g.pro_code, g.unit_level),
          qty: g.qty,
          image: imageOf(g.pro_code),
          main_pro_code: g.main_pro_code,
        })),
    ];
    const hh = happy as {
      is_happy_hour: boolean;
      num_cards?: number;
      qualifying_amount?: number;
      excess_discount?: number;
      total_reward?: number;
      reward_items?: {
        pro_code: string;
        pro_name: string | null;
        pro_nameTH?: string | null;
        pro_imgmain: string | null;
        unit: string | null;
        amount: number;
      }[];
    };
    if (hh.is_happy_hour) {
      for (const r of hh.reward_items ?? []) {
        if (!(r.amount > 0)) continue;
        gifts.push({
          kind: 'happy_hour',
          pro_code: r.pro_code,
          pro_name: r.pro_nameTH || r.pro_name,
          unit: r.unit ?? '',
          qty: r.amount,
          image: r.pro_imgmain,
        });
      }
    }

    // โปรที่ถึงขั้น จัดกลุ่มต่อโปร (มีบริษัท = Company Day ไม่มี = Wang Day)
    const promotions = new Map<
      number,
      {
        promo_id: number;
        promo_name: string;
        type: 'company' | 'wang';
        creditor_code: string | null;
        tiers: typeof base.reached_tiers;
      }
    >();
    for (const t of base.reached_tiers) {
      const entry = promotions.get(t.promo_id) ?? {
        promo_id: t.promo_id,
        promo_name: t.promo_name,
        type: t.creditor_code ? ('company' as const) : ('wang' as const),
        creditor_code: t.creditor_code,
        tiers: [],
      };
      entry.tiers.push(t);
      promotions.set(t.promo_id, entry);
    }

    const redeem = await this.checkRedeem(input.redeem, points, base.is_l16);

    return {
      mem_code: input.mem_code,
      price_option: base.price_option,
      is_l16: base.is_l16,
      generated_at: new Date().toISOString(),
      total: round2(base.total),
      points,
      lines: base.lines,
      skipped: base.skipped,
      promotions: [...promotions.values()],
      progress: base.progress.map((p) => ({
        ...p,
        type: p.creditor_code ? 'company' : 'wang',
      })),
      gifts,
      happy_hour: hh.is_happy_hour
        ? {
            num_cards: hh.num_cards ?? 0,
            qualifying_amount: hh.qualifying_amount ?? 0,
            excess_discount: hh.excess_discount ?? 0,
            total_reward: hh.total_reward ?? 0,
          }
        : null,
      redeem,
    };
  }

  /** ตรวจของแลกแต้มแบบเดียวกับ submit-order: อยู่ในชุดแลกแต้ม · ไม่เกินจำนวนต่อใบ · แต้มรวมไม่เกินแต้มของใบ */
  private async checkRedeem(
    selection: CheckoutPreviewInput['redeem'],
    points: number,
    isL16: boolean,
  ) {
    if (!selection.length) {
      return {
        valid: true,
        used_points: 0,
        remaining_points: points,
        items: [],
        errors: [],
      };
    }
    const set = await this.redeemSet.getCustomerSet();
    const byCode = new Map(
      set
        .filter(
          (i) =>
            i.isComingSoon !== true &&
            (!isL16 || i.displayProduct.pro_l16_only !== 1),
        )
        .map((i) => [i.displayProduct.pro_code, i]),
    );
    const qty = new Map<string, number>();
    for (const s of selection)
      qty.set(s.pro_code, (qty.get(s.pro_code) ?? 0) + s.amount);

    const errors: { pro_code: string; message: string }[] = [];
    const items: {
      pro_code: string;
      name: string;
      unit: string;
      amount: number;
      points_each: number;
      points: number;
    }[] = [];
    let used = 0;
    for (const [code, amount] of qty) {
      const item = byCode.get(code);
      if (!item) {
        errors.push({
          pro_code: code,
          message: `สินค้า ${code} ไม่ใช่สินค้าแลกแต้ม`,
        });
        continue;
      }
      if (amount > item.displayQuantity) {
        errors.push({
          pro_code: code,
          message: `สินค้า ${code} เลือกได้ไม่เกิน ${item.displayQuantity} ชิ้น`,
        });
        continue;
      }
      const each = Number(item.redeemProduct.pro_point ?? 0);
      const unit =
        [...(item.displayProduct.units ?? [])]
          .sort((a, b) => Number(a.level) - Number(b.level))[0]
          ?.unit_name?.trim() ?? '';
      used += each * amount;
      items.push({
        pro_code: code,
        name: item.displayProduct.pro_nameTH || item.displayProduct.pro_name,
        unit,
        amount,
        points_each: each,
        points: round2(each * amount),
      });
    }
    used = round2(used);
    if (used > points) {
      errors.push({
        pro_code: '',
        message: `แต้มไม่พอ: ใช้ ${used} แต้ม แต่ใบนี้ได้ ${points} แต้ม`,
      });
    }
    return {
      valid: errors.length === 0,
      used_points: used,
      remaining_points: round2(points - used),
      items,
      errors,
    };
  }
}
