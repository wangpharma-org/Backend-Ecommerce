import { toCompanyDayReport } from './company-day-report.util';
import type { PromotionEntity } from './promotion.entity';

describe('toCompanyDayReport (SSN0-255)', () => {
  const promotion = {
    promo_id: 7,
    promo_name: ' Company Day Mega ',
    // stored as UTC instants: 30 Jun 17:00Z = 1 Jul 00:00 Bangkok
    start_date: new Date('2026-06-30T17:00:00Z'),
    end_date: new Date('2026-07-31T16:59:59Z'),
    deleted_at: new Date('2026-08-05T03:00:00Z'),
    status: false,
    creditor: { creditor_code: 'C01', creditor_name: 'Mega' },
    creditors: [
      { creditor_code: 'C01', creditor_name: 'Mega' },
      { creditor_code: 'C02', creditor_name: 'Vida' },
    ],
    tiers: [
      {
        tier_id: 1,
        tier_name: 'ครบ 2,500',
        min_amount: '2500.00',
        is_unit: false,
        all_products: false,
        conditions: [
          { cond_id: 1, product: { pro_code: 'A1' } },
          { cond_id: 2, product: { pro_code: 'A1' } },
          { cond_id: 3, product: null },
          { cond_id: 4, product: { pro_code: 'B2' } },
        ],
        exclusions: [],
        rewards: [
          {
            reward_id: 1,
            qty: 1,
            unit: 'ใบ',
            giftProduct: { pro_code: 'LOTUS100', pro_name: 'บัตรโลตัส100' },
          },
          { reward_id: 2, qty: 1, unit: 'ชิ้น', giftProduct: null },
        ],
      },
      {
        tier_id: 2,
        tier_name: 'ทั้งร้าน',
        min_amount: 10000,
        is_unit: true,
        all_products: true,
        conditions: [],
        exclusions: [{ exclusion_id: 1, product_code: 'X9' }],
        rewards: [],
      },
      {
        tier_id: 3,
        tier_name: 'ลบแล้ว',
        min_amount: 1,
        deleted_at: new Date('2026-07-02T00:00:00Z'),
        conditions: [{ cond_id: 9, product: { pro_code: 'Z9' } }],
      },
    ],
  } as unknown as PromotionEntity;

  it('keeps local dates, dedupes creditors and condition codes', () => {
    const out = toCompanyDayReport(promotion);
    expect(out).toMatchObject({
      promoId: 7,
      promoName: 'Company Day Mega',
      startDate: '2026-07-01',
      endDate: '2026-07-31',
      status: false,
      deleted: true,
      creditors: [
        { code: 'C01', name: 'Mega' },
        { code: 'C02', name: 'Vida' },
      ],
    });
    expect(out.tiers[0]).toEqual({
      tierId: 1,
      tierName: 'ครบ 2,500',
      minAmount: 2500,
      isUnit: false,
      allProducts: false,
      proCodes: ['A1', 'B2'],
      excludedProCodes: [],
      rewards: [
        { proCode: 'LOTUS100', proName: 'บัตรโลตัส100', qty: 1, unit: 'ใบ' },
      ],
    });
    expect(out.tiers[1]).toMatchObject({
      allProducts: true,
      isUnit: true,
      proCodes: [],
      excludedProCodes: ['X9'],
    });
    expect(out.tiers.map((t) => t.tierId)).toEqual([1, 2]);
  });

  it('handles a promotion without the main creditor or tiers', () => {
    const out = toCompanyDayReport({
      ...promotion,
      creditor: null,
      creditors: undefined,
      tiers: undefined,
      deleted_at: null,
    } as unknown as PromotionEntity);
    expect(out.deleted).toBe(false);
    expect(out.creditors).toEqual([]);
    expect(out.tiers).toEqual([]);
  });
});
