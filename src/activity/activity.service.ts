import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { InjectDataSource } from '@nestjs/typeorm';
import { lastValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import {
  ACTIVITY_FLAG,
  ACTIVITY_KAFKA_CLIENT,
  ACTIVITY_TOPIC,
} from './activity.constants';
import { ActivityChannel, ActivityEvent, serverEvent } from './activity.types';

const FLAG_TTL_MS = 30_000;
const PROMO_TTL_MS = 10 * 60_000;
const PRODUCT_PROMO_TTL_MS = 60_000;

type PromoFeature = 'company_day' | 'wang_day';

interface OrderLineRow {
  soh_running: string;
  promotion_id: number | null;
  tier_id: number | null;
  is_reward: number | boolean;
  is_happy_hour: number | boolean | null;
  spo_total_decimal: string | number | null;
}

export interface OrderActivityContext {
  mem_code: string;
  emp_code?: string | null;
  channel: ActivityChannel;
}

/**
 * ส่งอีเวนต์กิจกรรมกลางเข้า Kafka topic activity_event (ฝั่งรับคือ sale-backend)
 *
 * ทุกเมธอด fire-and-forget: ห้าม throw และห้ามทำให้ตะกร้า/ออเดอร์ช้า
 * ไม่มี broker (KAFKA_ACTIVITY_BROKERS / KAFKA_BROKERS_SECOND) หรือ flag activity_tracking ปิด = ไม่ส่ง
 */
@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);
  private flag: { value: boolean; at: number } | null = null;
  private readonly productPromos = new Map<
    string,
    { promos: Array<{ promo_id: number; feature: PromoFeature }>; at: number }
  >();
  private readonly promoFeatures = new Map<
    number,
    { feature: PromoFeature; at: number }
  >();

  constructor(
    @Optional()
    @Inject(ACTIVITY_KAFKA_CLIENT)
    private readonly kafka: ClientKafka | null,
    private readonly featureFlags: FeatureFlagsService,
    @InjectDataSource() private readonly db: DataSource,
  ) {}

  async isEnabled(): Promise<boolean> {
    if (!this.kafka) return false;
    const now = Date.now();
    if (this.flag && now - this.flag.at < FLAG_TTL_MS) return this.flag.value;
    try {
      const value = Boolean(await this.featureFlags.getFlag(ACTIVITY_FLAG));
      this.flag = { value, at: now };
      return value;
    } catch {
      return false;
    }
  }

  /** ส่งอีเวนต์ชุดหนึ่ง — คืนจำนวนที่ส่งออกไป */
  async emit(events: ActivityEvent[]): Promise<number> {
    if (!events.length || !(await this.isEnabled()) || !this.kafka) return 0;
    let sent = 0;
    for (const event of events) {
      try {
        await lastValueFrom(
          this.kafka.emit(ACTIVITY_TOPIC, {
            key: event.mem_code ?? 'anonymous',
            value: JSON.stringify(event),
          }),
        );
        sent++;
      } catch (error) {
        this.logger.warn(
          `activity emit failed (${event.feature}/${event.action}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
    return sent;
  }

  /** Company Day (มี creditor) หรือ Wang Day (ไม่มี) — ตารางเดียวกัน แยกด้วย creditor_code */
  async featuresForPromos(
    promoIds: number[],
  ): Promise<Map<number, PromoFeature>> {
    const out = new Map<number, PromoFeature>();
    const now = Date.now();
    const missing: number[] = [];
    for (const id of new Set(promoIds)) {
      const hit = this.promoFeatures.get(id);
      if (hit && now - hit.at < PROMO_TTL_MS) out.set(id, hit.feature);
      else missing.push(id);
    }
    if (missing.length) {
      const rows: { promo_id: number; creditor_code: string | null }[] =
        await this.db.query(
          'SELECT promo_id, creditor_code FROM promotion WHERE promo_id IN (?)',
          [missing],
        );
      for (const row of rows) {
        const feature: PromoFeature = row.creditor_code
          ? 'company_day'
          : 'wang_day';
        this.promoFeatures.set(Number(row.promo_id), { feature, at: now });
        out.set(Number(row.promo_id), feature);
      }
    }
    return out;
  }

  /**
   * client ที่ไม่รู้ว่าโปรเป็น Company Day หรือ Wang Day (เช่นตะกร้า) ส่ง feature "promotion" + ref = promo_id
   * มาให้ — แปลงเป็นชื่อฟีเจอร์จริงที่นี่ · promo ที่ไม่พบถูกทิ้ง
   */
  async resolvePromotionFeature(
    events: ActivityEvent[],
  ): Promise<ActivityEvent[]> {
    const ids = events
      .filter((e) => e.feature === 'promotion')
      .map((e) => Number(e.ref))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (!ids.length) return events.filter((e) => e.feature !== 'promotion');
    const features = await this.featuresForPromos(ids);
    return events.flatMap((e) => {
      if (e.feature !== 'promotion') return [e];
      const feature = features.get(Number(e.ref));
      return feature ? [{ ...e, feature }] : [];
    });
  }

  /**
   * โปรที่เปิดอยู่ตอนนี้ซึ่งสินค้านี้นับเข้าเงื่อนไข — อยู่ใน promotion_condition ของ tier ใด tier หนึ่ง
   * หรือ tier นั้นเป็น "ทุกสินค้า" และไม่ได้ยกเว้นสินค้านี้ · cache ต่อสินค้า 1 นาที
   */
  async activePromosForProduct(
    proCode: string,
    now = new Date(),
  ): Promise<Array<{ promo_id: number; feature: PromoFeature }>> {
    const hit = this.productPromos.get(proCode);
    if (hit && now.getTime() - hit.at < PRODUCT_PROMO_TTL_MS) return hit.promos;
    const rows: { promo_id: number; creditor_code: string | null }[] =
      await this.db.query(
        `SELECT DISTINCT p.promo_id, p.creditor_code
           FROM promotion p
           JOIN promotion_tier t ON t.promo_id = p.promo_id
           LEFT JOIN promotion_condition c ON c.tier_id = t.tier_id AND c.product_code = ?
          WHERE p.status = 1 AND p.start_date <= ? AND p.end_date >= ?
            AND (c.product_code IS NOT NULL
                 OR (t.all_products = 1 AND NOT EXISTS (
                       SELECT 1 FROM promotion_tier_exclusion x
                        WHERE x.tier_id = t.tier_id AND x.product_code = ?)))`,
        [proCode, now, now, proCode],
      );
    const promos = rows.map((r) => ({
      promo_id: Number(r.promo_id),
      feature: (r.creditor_code ? 'company_day' : 'wang_day') as PromoFeature,
    }));
    this.productPromos.set(proCode, { promos, at: now.getTime() });
    return promos;
  }

  /**
   * ใส่ตะกร้าสินค้าที่นับเข้าโปรที่เปิดอยู่ — หนึ่งอีเวนต์ต่อโปร ไม่ว่าตะกร้าจะถึงขั้นแล้วหรือยัง
   * (เดิมนับเฉพาะตอนใส่แล้วถึงขั้น ทำให้การใส่ครั้งแรกที่ยอดยังไม่ถึงหายไป)
   */
  trackProductAddCart(input: {
    mem_code: string;
    pro_code: string;
    qty: number;
    placement: string | null;
    channel?: ActivityChannel;
    /// ขั้นที่ตะกร้าถึงหลังใส่ (ถ้ามี)
    reached?: { promo_id: number; tier: string | null } | null;
  }): void {
    void (async () => {
      try {
        if (!(await this.isEnabled())) return;
        const promos = await this.activePromosForProduct(input.pro_code);
        if (!promos.length) return;
        await this.emit(
          promos.map((p) =>
            serverEvent({
              feature: p.feature,
              action: 'add_cart',
              mem_code: input.mem_code,
              ref: String(p.promo_id),
              channel: input.channel ?? 'unknown',
              placement: input.placement,
              pro_code: input.pro_code,
              qty: input.qty,
              props:
                input.reached?.promo_id === p.promo_id && input.reached.tier
                  ? { reached_tier: input.reached.tier }
                  : null,
            }),
          ),
        );
      } catch (error) {
        this.logger.warn(`trackProductAddCart failed: ${String(error)}`);
      }
    })();
  }

  /**
   * ออเดอร์สำเร็จ — หนึ่งอีเวนต์ต่อ (ออเดอร์ × โปร) พร้อมยอดบาทของบรรทัดที่อยู่ในโปรนั้น
   * อ่านจาก shopping_order ที่บันทึกแล้ว จึงนับเฉพาะออเดอร์ที่สร้างสำเร็จจริง
   */
  trackOrders(runningNumbers: string[], ctx: OrderActivityContext): void {
    if (!runningNumbers.length) return;
    void (async () => {
      try {
        if (!(await this.isEnabled())) return;
        const rows: OrderLineRow[] = await this.db.query(
          `SELECT soh_running, promotion_id, tier_id, is_reward, is_happy_hour, spo_total_decimal
             FROM shopping_order
            WHERE soh_running IN (?) AND (promotion_id IS NOT NULL OR is_happy_hour = 1)`,
          [runningNumbers],
        );
        await this.emit(await this.orderEvents(rows, ctx));
      } catch (error) {
        this.logger.warn(`trackOrders failed: ${String(error)}`);
      }
    })();
  }

  async orderEvents(
    rows: OrderLineRow[],
    ctx: OrderActivityContext,
    now = new Date(),
  ): Promise<ActivityEvent[]> {
    const promoIds = rows
      .map((r) => r.promotion_id)
      .filter((id): id is number => id != null)
      .map(Number);
    const features = promoIds.length
      ? await this.featuresForPromos(promoIds)
      : new Map<number, PromoFeature>();

    type Acc = {
      feature: string;
      ref: string | null;
      doc_no: string;
      value: number;
      lines: number;
      reward_lines: number;
      tiers: Set<number>;
    };
    const groups = new Map<string, Acc>();
    const add = (feature: string, ref: string | null, row: OrderLineRow) => {
      const key = `${row.soh_running}|${feature}|${ref ?? ''}`;
      const acc = groups.get(key) ?? {
        feature,
        ref,
        doc_no: row.soh_running,
        value: 0,
        lines: 0,
        reward_lines: 0,
        tiers: new Set<number>(),
      };
      if (Number(row.is_reward)) acc.reward_lines++;
      else {
        acc.lines++;
        acc.value += Number(row.spo_total_decimal) || 0;
      }
      if (row.tier_id != null) acc.tiers.add(Number(row.tier_id));
      groups.set(key, acc);
    };

    for (const row of rows) {
      if (row.promotion_id != null) {
        const feature = features.get(Number(row.promotion_id));
        if (feature) add(feature, String(row.promotion_id), row);
      }
      if (Number(row.is_happy_hour)) add('happy_hour', null, row);
    }

    const emp = ctx.emp_code?.trim() || null;
    return [...groups.values()].map((g) =>
      serverEvent(
        {
          feature: g.feature,
          action: 'order',
          mem_code: ctx.mem_code,
          emp_code: emp,
          channel: ctx.channel,
          ref: g.ref,
          doc_no: g.doc_no,
          // โปรที่ให้แค่ของแถมในออเดอร์นี้ (เช่น Wang Day ทุกสินค้า ขณะที่บรรทัดขายติด Company Day)
          // ไม่รู้ว่ายอดไหนเป็นของโปรนี้ — value ว่าง ไม่ใส่ 0 ให้ดูเหมือนขายไม่ได้
          value: g.lines ? Math.round(g.value * 100) / 100 : null,
          qty: g.lines,
          props: {
            gift_only: g.lines === 0,
            reward_lines: g.reward_lines,
            tier_ids: [...g.tiers].sort((a, b) => a - b).join(',') || null,
          },
        },
        now,
      ),
    );
  }
}
