/**
 * ราคาต่อบรรทัดที่ "นับเข้าเงื่อนไขโปรโมชั่น" — กติกาเดียวกันทุกจุด
 *
 * ของเดิมแต่ละหน้าคิดเอง: engine ของแถมใช้ราคาโปรเดือนถ้าสินค้าติดโปรเดือนนั้น
 * แต่หน้า promo board นับที่ราคาตาม price option ล้วน ทำให้ยอดบนหน้าจอกับยอดที่
 * engine ใช้ตัดสินของแถมไม่ตรงกัน (ECWC-496 — ของแถมแต่ละหน้าไม่ตรงกัน)
 */

export type PriceOption = 'A' | 'B' | 'C';

export interface PricedProduct {
  pro_priceA: number | string;
  pro_priceB: number | string;
  pro_priceC: number | string;
  pro_promotion_month?: number | null;
  pro_promotion_amount?: number | null;
}

/** ราคาต่อหน่วยเล็กสุดตาม price option ของร้าน */
export function priceByOption(
  product: PricedProduct,
  option: PriceOption,
): number {
  if (option === 'A') return Number(product.pro_priceA);
  if (option === 'B') return Number(product.pro_priceB);
  return Number(product.pro_priceC);
}

/**
 * ราคาต่อหน่วยเล็กสุดที่ใช้คิดเงื่อนไขโปร
 * สินค้าที่ติดโปรเดือนนี้และสั่งครบจำนวนที่กำหนด ใช้ราคา A ไม่ว่าร้านจะอยู่ option ไหน
 *
 * @param totalUnitsOfProduct จำนวนหน่วยเล็กสุดรวมทุกบรรทัดของสินค้าตัวนี้ (คนละบรรทัดก็นับรวมกัน)
 */
export function promoUnitPrice(
  product: PricedProduct,
  option: PriceOption,
  totalUnitsOfProduct: number,
  month: number,
): number {
  const onMonthlyPromo =
    Number(product.pro_promotion_month) === month &&
    totalUnitsOfProduct >= Number(product.pro_promotion_amount ?? 0);

  return onMonthlyPromo
    ? Number(product.pro_priceA)
    : priceByOption(product, option);
}
