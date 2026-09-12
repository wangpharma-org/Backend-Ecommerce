import { computeAllocation } from './preorder.allocation';

describe('computeAllocation', () => {
  const queue = [
    { id: 1, amount: 10 },
    { id: 2, amount: 5 },
    { id: 3, amount: 8 },
  ];

  it('ให้ครบทุกคนเมื่อ supply พอ', () => {
    const r = computeAllocation(queue, 30, 'fifo');
    expect(r.map((x) => x.allocated_qty)).toEqual([10, 5, 8]);
  });

  it('fifo: เติมตามคิวจนหมด คนท้ายได้ 0', () => {
    const r = computeAllocation(queue, 12, 'fifo');
    expect(r.map((x) => x.allocated_qty)).toEqual([10, 2, 0]);
    expect(r.reduce((s, x) => s + x.allocated_qty, 0)).toBe(12);
  });

  it('prorata: แบ่งตามสัดส่วน เศษแจกทีละ 1 ตามคิว', () => {
    // total 23, supply 12 → floor: 5, 2, 4 = 11, เศษ 1 → คนแรก
    const r = computeAllocation(queue, 12, 'prorata');
    expect(r.map((x) => x.allocated_qty)).toEqual([6, 2, 4]);
    expect(r.reduce((s, x) => s + x.allocated_qty, 0)).toBe(12);
  });

  it('prorata: ไม่ให้เกินที่จอง', () => {
    const r = computeAllocation(
      [
        { id: 1, amount: 1 },
        { id: 2, amount: 100 },
      ],
      50,
      'prorata',
    );
    expect(r[0].allocated_qty).toBeLessThanOrEqual(1);
    expect(r.reduce((s, x) => s + x.allocated_qty, 0)).toBe(50);
  });

  it('equal: แบ่งเท่ากันวนตามคิว ร้านเล็กได้ครบก่อน', () => {
    // จอง 10,5,8 supply 12 → รอบละ 1: ได้ 4,4,4
    const r = computeAllocation(queue, 12, 'equal');
    expect(r.map((x) => x.allocated_qty)).toEqual([4, 4, 4]);
    // supply 20 → ร้าน 5 เต็มก่อน ที่เหลือแบ่งกัน: 8,5,7
    const r2 = computeAllocation(queue, 20, 'equal');
    expect(r2.map((x) => x.allocated_qty)).toEqual([8, 5, 7]);
    expect(r2.reduce((s, x) => s + x.allocated_qty, 0)).toBe(20);
  });

  it('supply 0 หรือติดลบ → ทุกคนได้ 0', () => {
    expect(
      computeAllocation(queue, 0, 'fifo').every((x) => x.allocated_qty === 0),
    ).toBe(true);
    expect(
      computeAllocation(queue, -5, 'prorata').every(
        (x) => x.allocated_qty === 0,
      ),
    ).toBe(true);
  });
});
