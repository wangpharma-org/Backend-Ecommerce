import { excludePromotionLines } from './happy-hour-promo-exclusion';

describe('excludePromotionLines (ECWC-747)', () => {
  it('returns input unchanged when no line is tagged with a promotion', () => {
    const items = [
      { pro_code: 'A', amount: 1000, promo_id: null },
      { pro_code: 'B', amount: 500 },
    ];
    const r = excludePromotionLines(1500, items);
    expect(r).toEqual({ orderAmount: 1500, items, excludedAmount: 0 });
  });

  it('removes promotion lines and subtracts their amount from the order total', () => {
    const r = excludePromotionLines(3000, [
      { pro_code: 'A', amount: 1000, promo_id: 7 },
      { pro_code: 'B', amount: 2000, promo_id: null },
    ]);
    expect(r.orderAmount).toBe(2000);
    expect(r.excludedAmount).toBe(1000);
    expect(r.items.map((i) => i.pro_code)).toEqual(['B']);
  });

  it('zeroes the order total when every line belongs to a promotion', () => {
    const r = excludePromotionLines(3000.4, [
      { pro_code: 'A', amount: 1000, promo_id: 7 },
      { pro_code: 'B', amount: 2000, promo_id: 9 },
    ]);
    expect(r.orderAmount).toBe(0);
    expect(r.items).toEqual([]);
  });

  it('never returns a negative total', () => {
    const r = excludePromotionLines(100, [
      { pro_code: 'A', amount: 500, promo_id: 1 },
      { pro_code: 'B', amount: 50, promo_id: null },
    ]);
    expect(r.orderAmount).toBe(0);
  });
});
