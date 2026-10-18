import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';

/// บรรทัดในตะกร้าตอนนี้ (ไม่รวมของแถมอัตโนมัติ) — ให้ระบบขายดู "ของที่ลูกค้าค้างไว้ในตะกร้า" ใน Key ขาย
export interface InternalCartLine {
  pro_code: string;
  pro_name: string | null;
  unit: string | null;
  unit_level: number;
  qty: number;
  /// ใส่/แก้ล่าสุด (shopping_cart.spc_datetime)
  added_at: string | null;
  /// ราคาต่อหน่วยที่ลูกค้าเห็นตอนนี้ (ระดับราคาของร้าน หรือราคา A ถ้าถึงขั้นโปรเดือน) — null = ไม่มีราคา
  unit_price: number | null;
  line_total: number | null;
  checked: boolean;
  promo: { monthly: boolean; flash_sale: boolean; hot_deal: boolean };
}

export interface InternalCustomerCart {
  mem_code: string;
  price_option: string | null;
  generated_at: string;
  lines: InternalCartLine[];
}

interface CartRow {
  pro_code: string;
  pro_name: string | null;
  unit_name: string | null;
  ratio: string | number | null;
  spc_unit_enum: string | null;
  spc_amount: string | number;
  spc_datetime: Date | string | null;
  spc_checked: number | boolean;
  pro_priceA: string | number | null;
  pro_priceB: string | number | null;
  pro_priceC: string | number | null;
  pro_promotion_month: number | null;
  pro_promotion_amount: number | null;
  flash: string | number | null;
  hotdeal: string | number | null;
}

/// บรรทัดที่ระบบขายสั่งไปแล้ว (หน่วยตามใบสั่งจอง) — ลดออกจากตะกร้าลูกค้า
export interface CartConsumeLine {
  pro_code: string;
  /// ชื่อหน่วยในใบสั่งจอง — ไม่รู้จัก = หน่วยเล็กสุด
  unit?: string | null;
  qty: number;
}

/// แถวตะกร้าที่ถูกลด/คืนจริง (หน่วยของแถวนั้น) — เก็บไว้คืนให้ตรงตอนยกเลิกใบ
export interface CartAdjustedRow {
  pro_code: string;
  unit_level: number;
  qty: number;
}

export interface CartAdjustmentResult {
  order_ref: string;
  kind: 'consume' | 'restore';
  mem_code: string;
  /// true = ทำไปแล้วก่อนหน้า (ส่งซ้ำ) — ไม่ได้แก้ตะกร้ารอบนี้
  replay: boolean;
  rows: CartAdjustedRow[];
  /// ส่วนที่สั่งเกินของในตะกร้า (หน่วยเล็กสุด) — ไม่ได้ลดอะไร
  not_in_cart: { pro_code: string; base_qty: number }[];
}

const bangkokToday = () =>
  new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

@Injectable()
export class InternalCustomerCartService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly cartService: ShoppingCartService,
  ) {}

  private async existing(
    m: EntityManager,
    orderRef: string,
    kind: 'consume' | 'restore',
  ): Promise<CartAdjustmentResult | null> {
    const [row] = await m.query<{ result: string | CartAdjustmentResult }[]>(
      'SELECT result FROM internal_cart_adjustment WHERE order_ref = ? AND kind = ? LIMIT 1',
      [orderRef, kind],
    );
    if (!row) return null;
    const r = (
      typeof row.result === 'string' ? JSON.parse(row.result) : row.result
    ) as CartAdjustmentResult;
    return { ...r, replay: true };
  }

  private async record(m: EntityManager, r: CartAdjustmentResult) {
    await m.query(
      'INSERT INTO internal_cart_adjustment (order_ref, kind, mem_code, result) VALUES (?, ?, ?, ?)',
      [
        r.order_ref,
        r.kind,
        r.mem_code,
        JSON.stringify({ ...r, replay: false }),
      ],
    );
  }

  /// ลดของในตะกร้าตามบรรทัดที่ระบบขายสั่งให้แล้ว — ครั้งเดียวต่อ order_ref (ส่งซ้ำ = คืนผลเดิม)
  /// ลดจากแถวที่ใส่ก่อนก่อน · ไม่ลดเกินที่สั่ง (เหลือเศษหน่วยใหญ่ = ปัดขึ้น คงไว้ในตะกร้า) · ไม่แตะของแถม
  /// แถวเหลือ 0 = ลบ · จบแล้วคิดของแถมโปร/ฮอตดีลใหม่แบบเดียวกับตะกร้า
  async consume(
    memCode: string,
    orderRef: string,
    lines: CartConsumeLine[],
  ): Promise<CartAdjustmentResult> {
    return this.dataSource.transaction(async (m) => {
      const done = await this.existing(m, orderRef, 'consume');
      if (done) return done;
      const rows: CartAdjustedRow[] = [];
      const notInCart: CartAdjustmentResult['not_in_cart'] = [];
      const wanted = new Map<string, number>();
      for (const l of lines) {
        const [u] = l.unit
          ? await m.query<{ ratio: string | number }[]>(
              'SELECT ratio FROM product_unit WHERE pro_code = ? AND unit_name = ? ORDER BY level LIMIT 1',
              [l.pro_code, l.unit],
            )
          : [];
        const ratio = Number(u?.ratio) || 1;
        wanted.set(
          l.pro_code,
          (wanted.get(l.pro_code) ?? 0) + Number(l.qty) * ratio,
        );
      }
      for (const [proCode, base] of wanted) {
        let remaining = base;
        const cart = await m.query<
          {
            spc_id: number;
            spc_amount: string | number;
            unit_level: string | number;
            ratio: string | number | null;
          }[]
        >(
          `SELECT c.spc_id, c.spc_amount, COALESCE(c.spc_unit_enum, '1') AS unit_level, u.ratio
             FROM shopping_cart c
             LEFT JOIN product_unit u ON u.pro_code = c.pro_code AND u.level = COALESCE(c.spc_unit_enum, 1)
            WHERE c.mem_code = ? AND c.pro_code = ? AND c.is_reward = 0 AND c.hotdeal_free = 0 AND c.spc_amount > 0
            ORDER BY c.spc_datetime ASC, c.spc_id ASC
            FOR UPDATE`,
          [memCode, proCode],
        );
        for (const c of cart) {
          if (remaining <= 0) break;
          const ratio = Number(c.ratio) || 1;
          const amount = Number(c.spc_amount);
          const take = Math.min(amount * ratio, remaining);
          const left = Math.ceil((amount * ratio - take) / ratio - 1e-9);
          remaining -= take;
          const removed = amount - left;
          if (removed <= 0) continue;
          if (left <= 0)
            await m.query('DELETE FROM shopping_cart WHERE spc_id = ?', [
              c.spc_id,
            ]);
          else
            await m.query(
              'UPDATE shopping_cart SET spc_amount = ? WHERE spc_id = ?',
              [left, c.spc_id],
            );
          rows.push({
            pro_code: proCode,
            unit_level: Number(c.unit_level),
            qty: removed,
          });
        }
        if (remaining > 1e-9)
          notInCart.push({ pro_code: proCode, base_qty: remaining });
      }
      const result: CartAdjustmentResult = {
        order_ref: orderRef,
        kind: 'consume',
        mem_code: memCode,
        replay: false,
        rows,
        not_in_cart: notInCart,
      };
      if (rows.length) await this.cartService.resyncDerivedRows(memCode, m);
      await this.record(m, result);
      return result;
    });
  }

  /// คืนของที่ order_ref นี้เคยลดไป (ยกเลิกใบสั่งจอง) — ครั้งเดียวต่อ order_ref · ไม่เคยลด = ไม่คืนอะไร
  /// มีแถวสินค้า/หน่วยเดิมอยู่แล้ว (ลูกค้าใส่เพิ่มระหว่างนั้น) = บวกเพิ่ม · ไม่มี = ใส่แถวใหม่
  async restore(
    memCode: string,
    orderRef: string,
  ): Promise<CartAdjustmentResult> {
    return this.dataSource.transaction(async (m) => {
      const done = await this.existing(m, orderRef, 'restore');
      if (done) return done;
      const consumed = await this.existing(m, orderRef, 'consume');
      if (consumed && consumed.mem_code !== memCode)
        throw new BadRequestException('order_ref นี้เป็นของร้านอื่น');
      const rows = consumed?.rows ?? [];
      for (const r of rows) {
        const [row] = await m.query<{ spc_id: number }[]>(
          `SELECT spc_id FROM shopping_cart
            WHERE mem_code = ? AND pro_code = ? AND COALESCE(spc_unit_enum, '1') = ? AND is_reward = 0 AND hotdeal_free = 0
            ORDER BY spc_id ASC LIMIT 1 FOR UPDATE`,
          [memCode, r.pro_code, String(r.unit_level)],
        );
        if (row)
          await m.query(
            'UPDATE shopping_cart SET spc_amount = spc_amount + ? WHERE spc_id = ?',
            [r.qty, row.spc_id],
          );
        else
          await m.query(
            `INSERT INTO shopping_cart (spc_amount, pro_code, mem_code, spc_checked, is_reward, use_code, hotdeal_free, spc_unit_enum, spc_datetime)
             VALUES (?, ?, ?, 1, 0, 0, 0, ?, CURRENT_TIMESTAMP)`,
            [r.qty, r.pro_code, memCode, String(r.unit_level)],
          );
      }
      const result: CartAdjustmentResult = {
        order_ref: orderRef,
        kind: 'restore',
        mem_code: memCode,
        replay: false,
        rows,
        not_in_cart: [],
      };
      if (rows.length) await this.cartService.resyncDerivedRows(memCode, m);
      await this.record(m, result);
      return result;
    });
  }

  /// อ่านอย่างเดียว — ไม่ใช้ getProductCart เพราะตัวนั้นลบ/ซิงก์ตะกร้าก่อนอ่าน
  async getCart(memCode: string): Promise<InternalCustomerCart> {
    const [member] = await this.dataSource.query<
      { mem_price: string | null }[]
    >('SELECT mem_price FROM users WHERE mem_code = ? LIMIT 1', [memCode]);
    const priceOption = member?.mem_price?.trim().toUpperCase() || null;
    const rows = await this.dataSource.query<CartRow[]>(
      `SELECT c.pro_code, COALESCE(p.pro_nameTH, p.pro_name) AS pro_name,
              u.unit_name, u.ratio, c.spc_unit_enum, c.spc_amount, c.spc_datetime, c.spc_checked,
              p.pro_priceA, p.pro_priceB, p.pro_priceC, p.pro_promotion_month, p.pro_promotion_amount,
              (SELECT COUNT(*) FROM flashsale_products fp JOIN flashsale f ON f.promotion_id = fp.promotion_id
                 WHERE fp.pro_code = c.pro_code AND f.is_active = 1 AND f.date = ?) AS flash,
              (SELECT COUNT(*) FROM hotdeal_entity h WHERE h.pro_code1 = c.pro_code) AS hotdeal
         FROM shopping_cart c
         LEFT JOIN product p ON p.pro_code = c.pro_code
         LEFT JOIN product_unit u ON u.pro_code = c.pro_code AND u.level = COALESCE(c.spc_unit_enum, 1)
        WHERE c.mem_code = ? AND c.is_reward = 0 AND c.hotdeal_free = 0 AND c.spc_amount > 0
        ORDER BY c.spc_datetime DESC, c.spc_id DESC`,
      [bangkokToday(), memCode],
    );
    const promoMonth = new Date(Date.now() + 7 * 3600e3).getUTCMonth() + 1;
    // ยอดรวมหน่วยเล็กสุดต่อสินค้า — เกณฑ์โปรเดือนเหมือนตะกร้า (shopping-cart.service findInvalidUseCodeRewards)
    const totalUnits = new Map<string, number>();
    for (const r of rows) {
      const ratio = Number(r.ratio) || 1;
      totalUnits.set(
        r.pro_code,
        (totalUnits.get(r.pro_code) ?? 0) + Number(r.spc_amount) * ratio,
      );
    }
    const lines = rows.map((r): InternalCartLine => {
      const ratio = Number(r.ratio) || 1;
      const monthly =
        r.pro_promotion_month != null &&
        Number(r.pro_promotion_month) === promoMonth;
      const promoPrice =
        monthly &&
        (totalUnits.get(r.pro_code) ?? 0) >=
          Number(r.pro_promotion_amount ?? 0);
      const base = promoPrice
        ? r.pro_priceA
        : priceOption === 'A'
          ? r.pro_priceA
          : priceOption === 'B'
            ? r.pro_priceB
            : r.pro_priceC;
      const unitPrice =
        base == null || base === '' ? null : Number(base) * ratio;
      const qty = Number(r.spc_amount);
      return {
        pro_code: r.pro_code,
        pro_name: r.pro_name,
        unit: r.unit_name,
        unit_level: Number(r.spc_unit_enum ?? 1),
        qty,
        added_at: r.spc_datetime
          ? new Date(r.spc_datetime).toISOString()
          : null,
        unit_price: unitPrice,
        line_total:
          unitPrice == null ? null : Math.round(unitPrice * qty * 100) / 100,
        checked: Boolean(Number(r.spc_checked)),
        promo: {
          monthly,
          flash_sale: Number(r.flash) > 0,
          hot_deal: Number(r.hotdeal) > 0,
        },
      };
    });
    return {
      mem_code: memCode,
      price_option: priceOption,
      generated_at: new Date().toISOString(),
      lines,
    };
  }
}
