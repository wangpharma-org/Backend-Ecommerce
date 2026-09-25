import { selectCurrentLots, toCurrentLots } from './lot-display.util';

describe('lot-display.util', () => {
  const lot = (
    lot_id: number,
    received_at: string | null,
    amount: number | null,
    is_active = true,
  ) => ({ lot_id, received_at, amount, is_active });

  describe('selectCurrentLots', () => {
    const older = lot(1, '2026-08-01', 100);
    const newer = lot(2, '2026-09-01', 50);

    it('stock ≤ amount ของ lot ล่าสุด → แสดง lot ล่าสุด lot เดียว', () => {
      expect(selectCurrentLots([older, newer], 50)).toEqual([newer]);
      expect(selectCurrentLots([older, newer], 10)).toEqual([newer]);
    });

    it('stock > amount ของ lot ล่าสุด → แสดง 2 lot ล่าสุด', () => {
      const oldest = lot(0, '2026-07-01', 30);
      expect(selectCurrentLots([oldest, older, newer], 51)).toEqual([
        newer,
        older,
      ]);
    });

    it('เรียงตาม received_at ไม่ใช่ lot_id', () => {
      const reusedRow = lot(1, '2026-09-10', 20); // lot เก่าที่รับเข้าใหม่ lot_id จึงน้อยกว่า
      expect(selectCurrentLots([reusedRow, newer], 5)).toEqual([reusedRow]);
    });

    it('lot ล่าสุดไม่มี amount (มาจาก add-lots) → แสดง 2 lot ล่าสุด (สูงสุด 2 lot เสมอ)', () => {
      const a = lot(1, null, null);
      const b = lot(2, null, null);
      const c = lot(3, null, null);
      expect(selectCurrentLots([a, b, c], 999)).toEqual([c, b]);
    });

    it('lot จาก add-lots (ไม่มี received_at) ถือว่าเก่ากว่า lot จาก new-arrivals', () => {
      const fromAddLots = lot(9, null, null);
      expect(selectCurrentLots([fromAddLots, newer], 80)).toEqual([
        newer,
        fromAddLots,
      ]);
    });

    it('stock เป็น null/ติดลบ → แสดง lot ล่าสุด lot เดียว', () => {
      expect(selectCurrentLots([older, newer], null)).toEqual([newer]);
      expect(selectCurrentLots([older, newer], -5)).toEqual([newer]);
    });

    it('ไม่มี lot → []', () => {
      expect(selectCurrentLots([], 10)).toEqual([]);
    });
  });

  describe('toCurrentLots', () => {
    it('ส่งเฉพาะ lot ปัจจุบัน และซ่อน amount', () => {
      const older = lot(2, '2026-08-01', 100);
      const newer = lot(3, '2026-09-01', 50);

      const result = toCurrentLots([older, newer], 20);

      expect(result.map((l) => l.lot_id)).toEqual([3]);
      expect(result[0].amount).toBeNull();
    });
  });
});
