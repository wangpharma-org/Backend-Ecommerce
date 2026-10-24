import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 400;

export interface PromotionScopeTier {
  tier_id: number;
  tier_name: string;
  min_amount: number;
  is_unit: boolean;
  all_products: boolean;
}

export interface PromotionScope {
  promo_id: number;
  promo_name: string;
  feature: 'company_day' | 'wang_day';
  /** เวลาไทยตามที่บันทึกในฐาน (YYYY-MM-DD HH:mm:ss) */
  start_date: string;
  end_date: string;
  status: boolean;
  creditors: { code: string; name: string | null }[];
  tiers: PromotionScopeTier[];
  /** มีขั้นที่ร่วมทุกสินค้า — product_codes จึงไม่ครบ ใช้ excluded_product_codes แทน */
  all_products: boolean;
  /** สินค้าตามเงื่อนไขของทุกขั้น (ไม่ซ้ำ) */
  product_codes: string[];
  /** ไม่เข้าร่วมในทุกขั้นที่เป็น all_products (ไม่อยู่ในเงื่อนไขของขั้นอื่นด้วย) */
  excluded_product_codes: string[];
  /** ของแถมของโปรนี้ในออเดอร์ e-commerce ช่วง from–to (ค่าเริ่มต้น = ช่วงโปร) */
  gifts: { pro_code: string; unit: string; qty: number; orders: number }[];
}

export interface PromotionListItem {
  promo_id: number;
  promo_name: string;
  feature: 'company_day' | 'wang_day';
  start_date: string;
  end_date: string;
  status: boolean;
}

export function parseRange(
  from: unknown,
  to: unknown,
): { from: string; to: string } | null {
  if (from == null && to == null) return null;
  if (
    typeof from !== 'string' ||
    typeof to !== 'string' ||
    !DATE_PATTERN.test(from) ||
    !DATE_PATTERN.test(to)
  )
    throw new BadRequestException('from/to ต้องเป็น YYYY-MM-DD ทั้งคู่');
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (!Number.isFinite(days) || days < 0 || days > MAX_RANGE_DAYS)
    throw new BadRequestException(
      `ช่วงวันที่ต้องไม่ย้อนกลับและไม่เกิน ${MAX_RANGE_DAYS} วัน`,
    );
  return { from, to };
}

/**
 * ขอบเขตของโปรสำหรับวิเคราะห์ (sale-backend หน้า dashboard กิจกรรม): ช่วงเวลา, เจ้าหนี้, ขั้น, สินค้าที่นับ
 * อ่านได้ทั้งโปรที่จบแล้ว — ต่างจาก customer-promotions ที่ให้เฉพาะโปรที่เปิดอยู่
 */
@Injectable()
export class PromotionScopeService {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  async scope(
    rawPromoId: unknown,
    rawFrom?: unknown,
    rawTo?: unknown,
  ): Promise<PromotionScope> {
    const promoId = Number(rawPromoId);
    if (!Number.isInteger(promoId) || promoId < 1)
      throw new BadRequestException('promo_id ต้องเป็นจำนวนเต็มบวก');
    const range = parseRange(rawFrom, rawTo);

    const [promo] = await this.db.query<
      Array<{
        promo_id: number;
        promo_name: string;
        creditor_code: string | null;
        start_date: string;
        end_date: string;
        status: number;
      }>
    >(
      `SELECT promo_id, promo_name, creditor_code, status,
              DATE_FORMAT(start_date, '%Y-%m-%d %H:%i:%s') start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d %H:%i:%s') end_date
         FROM promotion WHERE promo_id = ? AND deleted_at IS NULL`,
      [promoId],
    );
    if (!promo) throw new NotFoundException(`ไม่พบโปร ${promoId}`);

    const [creditors, tiers, conditions, exclusions] = await Promise.all([
      this.db.query<Array<{ code: string; name: string | null }>>(
        `SELECT c.creditor_code code, c.creditor_name name FROM creditor c
          WHERE c.creditor_code = ?
             OR c.creditor_code IN (SELECT pc.creditor_code FROM promotion_creditor pc WHERE pc.promo_id = ?)
          ORDER BY c.creditor_code`,
        [promo.creditor_code ?? '', promoId],
      ),
      this.db.query<
        Array<{
          tier_id: number;
          tier_name: string;
          min_amount: string;
          is_unit: number;
          all_products: number;
        }>
      >(
        `SELECT tier_id, tier_name, min_amount, is_unit, all_products FROM promotion_tier
          WHERE promo_id = ? AND deleted_at IS NULL ORDER BY min_amount, tier_id`,
        [promoId],
      ),
      this.db.query<Array<{ product_code: string }>>(
        `SELECT DISTINCT c.product_code FROM promotion_condition c
           JOIN promotion_tier t ON t.tier_id = c.tier_id
          WHERE t.promo_id = ? AND t.deleted_at IS NULL ORDER BY c.product_code`,
        [promoId],
      ),
      this.db.query<Array<{ tier_id: number; product_code: string }>>(
        `SELECT x.tier_id, x.product_code FROM promotion_tier_exclusion x
           JOIN promotion_tier t ON t.tier_id = x.tier_id
          WHERE t.promo_id = ? AND t.deleted_at IS NULL AND t.all_products = 1`,
        [promoId],
      ),
    ]);

    const allTiers = tiers.filter((t) => Boolean(Number(t.all_products)));
    const productCodes = conditions.map((c) => c.product_code);
    const inConditions = new Set(productCodes);
    // สินค้าที่ไม่นับ = ถูกตัดออกจากทุกขั้น all_products และไม่อยู่ในเงื่อนไขของขั้นอื่น
    const excludedBy = new Map<string, number>();
    for (const x of exclusions)
      excludedBy.set(x.product_code, (excludedBy.get(x.product_code) ?? 0) + 1);
    const excluded = allTiers.length
      ? [...excludedBy]
          .filter(
            ([code, n]) => n >= allTiers.length && !inConditions.has(code),
          )
          .map(([code]) => code)
          .sort()
      : [];

    const window = range
      ? [`${range.from} 00:00:00`, `${range.to} 23:59:59`]
      : [promo.start_date, promo.end_date];
    const gifts = await this.db.query<
      Array<{ pro_code: string; unit: string; qty: string; orders: string }>
    >(
      `SELECT o.pro_code, o.spo_unit unit, SUM(o.spo_qty) qty, COUNT(DISTINCT o.soh_running) orders
         FROM shopping_order o
         JOIN shopping_head h ON h.soh_running = o.soh_running
        WHERE o.promotion_id = ? AND o.is_reward = 1
          AND h.soh_datetime BETWEEN ? AND ?
        GROUP BY o.pro_code, o.spo_unit ORDER BY o.pro_code`,
      [promoId, window[0], window[1]],
    );

    return {
      promo_id: promo.promo_id,
      promo_name: promo.promo_name,
      feature: promo.creditor_code ? 'company_day' : 'wang_day',
      start_date: promo.start_date,
      end_date: promo.end_date,
      status: Boolean(Number(promo.status)),
      creditors: creditors.map((c) => ({ code: c.code, name: c.name })),
      tiers: tiers.map((t) => ({
        tier_id: Number(t.tier_id),
        tier_name: t.tier_name,
        min_amount: Number(t.min_amount),
        is_unit: Boolean(Number(t.is_unit)),
        all_products: Boolean(Number(t.all_products)),
      })),
      all_products: allTiers.length > 0,
      product_codes: productCodes,
      excluded_product_codes: excluded,
      gifts: gifts.map((g) => ({
        pro_code: g.pro_code,
        unit: g.unit,
        qty: Number(g.qty),
        orders: Number(g.orders),
      })),
    };
  }

  /** โปร Company Day / Wang Day ที่ช่วงเวลาทับกับ from–to (ทั้งที่เปิดอยู่และจบแล้ว) */
  async list(rawFrom: unknown, rawTo: unknown): Promise<PromotionListItem[]> {
    const range = parseRange(rawFrom, rawTo);
    if (!range) throw new BadRequestException('ต้องระบุ from และ to');
    const rows = await this.db.query<
      Array<{
        promo_id: number;
        promo_name: string;
        creditor_code: string | null;
        start_date: string;
        end_date: string;
        status: number;
      }>
    >(
      `SELECT promo_id, promo_name, creditor_code, status,
              DATE_FORMAT(start_date, '%Y-%m-%d %H:%i:%s') start_date,
              DATE_FORMAT(end_date, '%Y-%m-%d %H:%i:%s') end_date
         FROM promotion
        WHERE deleted_at IS NULL AND start_date <= ? AND end_date >= ?
        ORDER BY start_date DESC, promo_id DESC LIMIT 500`,
      [`${range.to} 23:59:59`, `${range.from} 00:00:00`],
    );
    return rows.map((p) => ({
      promo_id: p.promo_id,
      promo_name: p.promo_name,
      feature: p.creditor_code ? 'company_day' : 'wang_day',
      start_date: p.start_date,
      end_date: p.end_date,
      status: Boolean(Number(p.status)),
    }));
  }
}
