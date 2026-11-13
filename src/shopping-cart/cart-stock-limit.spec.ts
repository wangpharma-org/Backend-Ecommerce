import {
  cartRowsSmallestUnits,
  exceedsStock,
  unitRatio,
} from './cart-stock-limit';

// สินค้าตัวอย่าง: 1 แผง = 1, 1 กล่อง = 10 แผง, 1 ลัง = 100 แผง
const units = [
  { level: 1, ratio: 1 },
  { level: 2, ratio: 10 },
  { level: 3, ratio: 100 },
];

describe('cart-stock-limit (ECWC-766)', () => {
  describe('unitRatio', () => {
    it('คืน ratio ตาม level (รับทั้ง string และ number)', () => {
      expect(unitRatio(units, '2')).toBe(10);
      expect(unitRatio(units, 3)).toBe(100);
    });
    it('ไม่พบหน่วย / ratio ผิด → 1', () => {
      expect(unitRatio(units, '9')).toBe(1);
      expect(unitRatio([{ level: 1, ratio: 'abc' }], 1)).toBe(1);
      expect(unitRatio([{ level: 1, ratio: 0 }], 1)).toBe(1);
      expect(unitRatio(units, null)).toBe(1);
    });
  });

  describe('cartRowsSmallestUnits', () => {
    it('รวมทุกหน่วยเป็นหน่วยเล็กสุด และข้ามจำนวนที่ไม่ใช่ตัวเลขบวก', () => {
      expect(
        cartRowsSmallestUnits(
          [
            { spc_amount: '2', spc_unit_enum: '2' },
            { spc_amount: 3, spc_unit_enum: '1' },
            { spc_amount: 'x', spc_unit_enum: '3' },
            { spc_amount: -1, spc_unit_enum: '3' },
          ],
          units,
        ),
      ).toBe(23);
    });
  });

  describe('exceedsStock', () => {
    it('เพิ่มพอดีสต็อก → ไม่เกิน', () => {
      expect(
        exceedsStock({
          rows: [{ spc_amount: 5, spc_unit_enum: '1' }],
          units,
          addAmount: 5,
          addUnitLevel: '1',
          stock: 10,
        }),
      ).toBe(false);
    });

    it('เพิ่มเกินสต็อก 1 หน่วยเล็กสุด → เกิน', () => {
      expect(
        exceedsStock({
          rows: [{ spc_amount: 5, spc_unit_enum: '1' }],
          units,
          addAmount: 6,
          addUnitLevel: '1',
          stock: 10,
        }),
      ).toBe(true);
    });

    it('นับข้ามหน่วย: มี 1 กล่อง (10) อยู่แล้ว เพิ่มอีก 1 แผง กับสต็อก 10 → เกิน', () => {
      expect(
        exceedsStock({
          rows: [{ spc_amount: 1, spc_unit_enum: '2' }],
          units,
          addAmount: 1,
          addUnitLevel: '1',
          stock: 10,
        }),
      ).toBe(true);
    });

    it('หน่วยใหญ่: เพิ่ม 1 ลัง (100) กับสต็อก 99 → เกิน', () => {
      expect(
        exceedsStock({
          rows: [],
          units,
          addAmount: 1,
          addUnitLevel: '3',
          stock: 99,
        }),
      ).toBe(true);
    });

    it('ลดจำนวน (amount ติดลบ/0) → ไม่เกินเสมอ แม้ตะกร้าเกินสต็อกอยู่แล้ว', () => {
      const rows = [{ spc_amount: 50, spc_unit_enum: '1' }];
      expect(
        exceedsStock({
          rows,
          units,
          addAmount: -1,
          addUnitLevel: '1',
          stock: 10,
        }),
      ).toBe(false);
      expect(
        exceedsStock({
          rows,
          units,
          addAmount: 0,
          addUnitLevel: '1',
          stock: 10,
        }),
      ).toBe(false);
    });

    it('สต็อก 0 / null / ติดลบ / ไม่ใช่ตัวเลข → เพิ่มไม่ได้', () => {
      for (const stock of [0, null, undefined, -5, 'abc']) {
        expect(
          exceedsStock({
            rows: [],
            units,
            addAmount: 1,
            addUnitLevel: '1',
            stock,
          }),
        ).toBe(true);
      }
    });

    it('addAmount ไม่ใช่ตัวเลข → ไม่ตัดสิน (ให้ validation อื่นจัดการ)', () => {
      expect(
        exceedsStock({
          rows: [],
          units,
          addAmount: Number('2a'),
          addUnitLevel: '1',
          stock: 0,
        }),
      ).toBe(false);
    });
  });
});
