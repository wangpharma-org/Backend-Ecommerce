import { applyAmountChange, distributeToLots } from './preorder.lots';

const t0 = new Date('2026-09-09T00:00:00Z');
const t1 = new Date('2026-09-09T05:00:00Z');
const now = new Date('2026-09-10T12:00:00Z'); // 36 ชม. หลัง t0

describe('applyAmountChange', () => {
  it('ลดจำนวน: ตัดจากล็อตท้ายก่อน ล็อตแรกคงคิว', () => {
    const r = applyAmountChange(
      [
        { id: 1, qty: 4, ordered_at: t0 },
        { id: 2, qty: 3, ordered_at: t1 },
      ],
      5,
      'split',
      null,
      now,
    );
    expect(r.lots.map((l) => l.qty)).toEqual([4, 1]);
    expect(r.removedIds).toEqual([]);
    expect(r.itemOrderedAt).toEqual(t0);
  });

  it('ลดจนล็อตท้ายหมด → ลบล็อตนั้น', () => {
    const r = applyAmountChange(
      [
        { id: 1, qty: 4, ordered_at: t0 },
        { id: 2, qty: 3, ordered_at: t1 },
      ],
      2,
      'keep',
      null,
      now,
    );
    expect(r.lots).toEqual([{ id: 1, qty: 2, ordered_at: t0 }]);
    expect(r.removedIds).toEqual([2]);
  });

  it('keep: เพิ่มเข้าล็อตแรก', () => {
    const r = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      6,
      'keep',
      null,
      now,
    );
    expect(r.lots).toEqual([{ id: 1, qty: 6, ordered_at: t0 }]);
    expect(r.itemOrderedAt).toEqual(t0);
  });

  it('split: ส่วนที่เพิ่มเป็นล็อตใหม่ ณ now', () => {
    const r = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      6,
      'split',
      null,
      now,
    );
    expect(r.lots).toEqual([
      { id: 1, qty: 2, ordered_at: t0 },
      { qty: 4, ordered_at: now },
    ]);
    expect(r.itemOrderedAt).toEqual(t0);
  });

  it('reset: รวมทุกล็อตเป็นล็อตเดียว ณ now และเวลาจองรายการเปลี่ยน', () => {
    const r = applyAmountChange(
      [
        { id: 1, qty: 2, ordered_at: t0 },
        { id: 2, qty: 1, ordered_at: t1 },
      ],
      6,
      'reset',
      null,
      now,
    );
    expect(r.lots).toEqual([{ qty: 6, ordered_at: now }]);
    expect(r.removedIds.sort()).toEqual([1, 2]);
    expect(r.itemOrderedAt).toEqual(now);
  });

  it('ช่วงผ่อนผัน: split/reset ภายใน grace → ทำตัวเป็น keep', () => {
    const soon = new Date(t0.getTime() + 2 * 3600 * 1000); // 2 ชม. หลังจอง
    const r = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      5,
      'split',
      24,
      soon,
    );
    expect(r.lots).toEqual([{ id: 1, qty: 5, ordered_at: t0 }]);
    const r2 = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      5,
      'reset',
      24,
      soon,
    );
    expect(r2.lots).toEqual([{ id: 1, qty: 5, ordered_at: t0 }]);
  });

  it('พ้นช่วงผ่อนผัน → ใช้นโยบายจริง', () => {
    const r = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      5,
      'split',
      24,
      now,
    );
    expect(r.lots.length).toBe(2);
  });

  it('จำนวนเท่าเดิม → ไม่เปลี่ยนอะไร', () => {
    const r = applyAmountChange(
      [{ id: 1, qty: 2, ordered_at: t0 }],
      2,
      'reset',
      null,
      now,
    );
    expect(r.lots).toEqual([{ id: 1, qty: 2, ordered_at: t0 }]);
    expect(r.removedIds).toEqual([]);
  });
});

describe('distributeToLots', () => {
  it('เติมล็อตแรกก่อน', () => {
    expect(distributeToLots([{ qty: 4 }, { qty: 3 }], 5)).toEqual([4, 1]);
    expect(distributeToLots([{ qty: 4 }, { qty: 3 }], 0)).toEqual([0, 0]);
    expect(distributeToLots([{ qty: 4 }, { qty: 3 }], 10)).toEqual([4, 3]);
  });
});
