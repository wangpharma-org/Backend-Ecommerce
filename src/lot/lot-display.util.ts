// ECWC-643: เลือก lot ที่จะแสดงเป็น "lot ปัจจุบัน" จาก lot ที่ยัง active อยู่
// ตัดสินตอนแสดงผลด้วย stock ปัจจุบัน (ไม่ตัดสินตอน new-arrival เพราะตอนนั้น stock ยังไม่รวมของที่เพิ่งเข้า)
//  - stock ≤ amount ของ lot ล่าสุด → ของที่เหลือมาจาก lot ล่าสุดทั้งหมด → แสดง lot เดียว
//  - stock > amount ของ lot ล่าสุด → ยังมีของ lot ก่อนหน้าเหลือ → แสดง 2 lot ล่าสุด
//  - lot ล่าสุดไม่มี amount (มาจาก add-lots) → แสดง 2 lot ล่าสุด
// แสดงสูงสุด 2 lot เสมอ
export interface DisplayableLot {
  lot_id: number;
  amount?: number | null;
  received_at?: Date | string | null;
}

const receivedTime = (lot: DisplayableLot): number =>
  lot.received_at ? new Date(lot.received_at).getTime() : -Infinity;

export function selectCurrentLots<T extends DisplayableLot>(
  activeLots: T[],
  stock: number | null | undefined,
): T[] {
  if (activeLots.length === 0) return [];

  const sorted = [...activeLots].sort(
    (a, b) => receivedTime(b) - receivedTime(a) || b.lot_id - a.lot_id,
  );
  const newest = sorted[0];
  if (newest.amount === null || newest.amount === undefined) {
    return sorted.slice(0, 2);
  }

  return Number(stock ?? 0) <= newest.amount
    ? sorted.slice(0, 1)
    : sorted.slice(0, 2);
}

// lot ปัจจุบันสำหรับส่งให้หน้าเว็บ (ไม่ส่งประวัติ) — ซ่อน amount (จำนวนรับเข้า)
export function toCurrentLots<T extends DisplayableLot>(
  activeLots: T[],
  stock: number | null | undefined,
): (T & { amount: null })[] {
  return selectCurrentLots(activeLots, stock).map((l) => ({
    ...l,
    amount: null,
  }));
}
