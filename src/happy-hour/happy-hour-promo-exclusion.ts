// ECWC-747: Happy Hour ไม่รวมกับ Promotion (Company Day / Wang Day)
// บรรทัดที่ติด promo_id = นับเข้า tier ของโปรที่ถึงเกณฑ์แล้ว (ตั้งโดย ShoppingCartService.syncConditionTagsToCart)
// จึงไม่นับเข้ายอดขั้นต่ำ Happy Hour อีก — สินค้าอื่นในบิลยังได้ Happy Hour ตามปกติ
export const HAPPY_HOUR_EXCLUDE_PROMOTION_FLAG = 'happy_hour_exclude_promotion';

export interface HappyHourPromoLine {
  amount: number;
  promo_id?: number | null;
}

export function excludePromotionLines<T extends HappyHourPromoLine>(
  orderAmount: number,
  items: T[],
): { orderAmount: number; items: T[]; excludedAmount: number } {
  // ใช้ != null ไม่ใช่ truthy/String() — คอลัมน์ promo_id เป็น int NULL (ดู G-002)
  const kept = items.filter((i) => i.promo_id == null);
  if (kept.length === items.length) {
    return { orderAmount, items, excludedAmount: 0 };
  }
  const excludedAmount = items
    .filter((i) => i.promo_id != null)
    .reduce((sum, i) => sum + Number(i.amount), 0);
  return {
    // ทุกบรรทัดเข้าโปร → ไม่เหลือยอดให้ Happy Hour (กันเศษจากยอดกลุ่มที่ปัดต่างจากผลรวมบรรทัด)
    orderAmount: kept.length ? Math.max(0, orderAmount - excludedAmount) : 0,
    items: kept,
    excludedAmount,
  };
}
