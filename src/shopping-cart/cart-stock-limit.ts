// ECWC-766: ห้ามลูกค้าใส่ตะกร้าเกินสต็อกที่ระบบมี
// - เทียบเป็นหน่วยเล็กสุด (pro_stock เก็บเป็นหน่วยเล็กสุด เหมือน cart-basket / new-arrivals)
// - รวมทุกแถวของสินค้าเดียวกันในตะกร้า (ทุกหน่วย + แถวกระเช้า) ยกเว้นของแถม hotdeal / ของรางวัล
// - เช็คเฉพาะตอนเพิ่มจำนวน — ลดจำนวนทำได้เสมอ แม้ของในตะกร้าจะเกินสต็อกอยู่แล้ว (สต็อกลดทีหลัง)
// - ไม่บอกตัวเลขสต็อกกับลูกค้า (ตกลงกับผู้ใช้ 13 พ.ย. 69)

export const CART_STOCK_LIMIT_FLAG = 'cart_stock_limit';

export const CART_STOCK_LIMIT_MESSAGE =
  'จำนวนที่สั่งเกินกว่าสินค้าคงเหลือในระบบ หากต้องการสั่งมากกว่านี้ กรุณาติดต่อฝ่ายขาย หรือ Line @wangpharma';

export interface StockLimitUnit {
  level: number | string;
  ratio: number | string | null | undefined;
}

export interface StockLimitCartRow {
  spc_amount: number | string | null | undefined;
  spc_unit_enum: string | number | null | undefined;
}

/** ratio ของหน่วยระดับนั้น — ไม่พบ/ไม่ใช่ตัวเลขบวก ถือเป็น 1 (กติกาเดียวกับ cart-basket) */
export function unitRatio(
  units: StockLimitUnit[],
  level: string | number | null | undefined,
): number {
  const unit = units.find((u) => Number(u.level) === Number(level ?? 1));
  const ratio = Number(unit?.ratio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
}

/** จำนวนรวมหน่วยเล็กสุดของแถวในตะกร้า */
export function cartRowsSmallestUnits(
  rows: StockLimitCartRow[],
  units: StockLimitUnit[],
): number {
  return rows.reduce((sum, row) => {
    const amount = Number(row.spc_amount);
    if (!Number.isFinite(amount) || amount <= 0) return sum;
    return sum + amount * unitRatio(units, row.spc_unit_enum);
  }, 0);
}

/**
 * true = การเพิ่มครั้งนี้ทำให้จำนวนในตะกร้าเกินสต็อก
 * addAmount ≤ 0 (ลด/ลบ) ไม่ถือว่าเกินเสมอ
 */
export function exceedsStock(input: {
  rows: StockLimitCartRow[];
  units: StockLimitUnit[];
  addAmount: number;
  addUnitLevel: string | number;
  stock: number | string | null | undefined;
}): boolean {
  const addAmount = Number(input.addAmount);
  if (!Number.isFinite(addAmount) || addAmount <= 0) return false;
  const stock = Number(input.stock ?? 0);
  const available = Number.isFinite(stock) ? Math.max(stock, 0) : 0;
  const requested =
    cartRowsSmallestUnits(input.rows, input.units) +
    addAmount * unitRatio(input.units, input.addUnitLevel);
  return requested > available;
}
