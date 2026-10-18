import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

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

const bangkokToday = () =>
  new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

@Injectable()
export class InternalCustomerCartService {
  constructor(private readonly dataSource: DataSource) {}

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
