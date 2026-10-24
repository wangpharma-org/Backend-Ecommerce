import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { parseRange, PromotionScopeService } from './promotion-scope.service';

describe('parseRange', () => {
  it('no dates = no range', () => {
    expect(parseRange(undefined, undefined)).toBeNull();
  });
  it('accepts a forward range', () => {
    expect(parseRange('2026-10-01', '2026-10-31')).toEqual({
      from: '2026-10-01',
      to: '2026-10-31',
    });
  });
  it.each([
    ['2026-10-31', '2026-10-01'],
    ['2026-10-01', undefined],
    ['2026-10-1', '2026-10-31'],
    ['2025-01-01', '2026-10-31'],
  ])('rejects %s → %s', (from, to) => {
    expect(() => parseRange(from, to)).toThrow(BadRequestException);
  });
});

describe('PromotionScopeService.scope', () => {
  const promo = {
    promo_id: 7,
    promo_name: 'E2E promo',
    creditor_code: 'CR1',
    start_date: '2026-10-01 00:00:00',
    end_date: '2026-10-31 23:59:59',
    status: 1,
  };
  function service(responses: unknown[][]) {
    const query = jest.fn<Promise<unknown[]>, [string, unknown[]]>();
    for (const r of responses) query.mockResolvedValueOnce(r);
    return {
      svc: new PromotionScopeService({ query } as unknown as DataSource),
      query,
    };
  }

  it('404 for a missing promo', async () => {
    const { svc } = service([[]]);
    await expect(svc.scope('9')).rejects.toThrow('ไม่พบโปร 9');
  });

  it('rejects a non-integer promo id before querying', async () => {
    const { svc, query } = service([]);
    await expect(svc.scope('7a')).rejects.toThrow(BadRequestException);
    expect(query).not.toHaveBeenCalled();
  });

  it('excludes only products cut from every all-products tier and not in a condition', async () => {
    const { svc, query } = service([
      [promo],
      [{ code: 'CR1', name: 'Creditor 1' }],
      [
        {
          tier_id: 1,
          tier_name: 'A',
          min_amount: '500.00',
          is_unit: 0,
          all_products: 1,
        },
        {
          tier_id: 2,
          tier_name: 'B',
          min_amount: '900.00',
          is_unit: 0,
          all_products: 1,
        },
        {
          tier_id: 3,
          tier_name: 'C',
          min_amount: '30.00',
          is_unit: 1,
          all_products: 0,
        },
      ],
      [{ product_code: 'P-COND' }],
      [
        { tier_id: 1, product_code: 'X-BOTH' },
        { tier_id: 2, product_code: 'X-BOTH' },
        { tier_id: 1, product_code: 'X-ONE' },
        { tier_id: 1, product_code: 'P-COND' },
        { tier_id: 2, product_code: 'P-COND' },
      ],
      [{ pro_code: 'G1', unit: 'ใบ', qty: '3.00', orders: '2' }],
    ]);
    const scope = await svc.scope('7');
    expect(scope.feature).toBe('company_day');
    expect(scope.all_products).toBe(true);
    expect(scope.product_codes).toEqual(['P-COND']);
    expect(scope.excluded_product_codes).toEqual(['X-BOTH']);
    expect(scope.tiers[2]).toMatchObject({
      is_unit: true,
      all_products: false,
      min_amount: 30,
    });
    expect(scope.gifts).toEqual([
      { pro_code: 'G1', unit: 'ใบ', qty: 3, orders: 2 },
    ]);
    // ของแถมนับตามช่วงโปรเมื่อไม่ระบุช่วง
    expect(query.mock.calls[5][1]).toEqual([
      7,
      '2026-09-30 17:00:00',
      '2026-10-31 16:59:59',
    ]);
  });

  it('wang_day without creditor and gifts in the asked range', async () => {
    const { svc, query } = service([
      [{ ...promo, creditor_code: null }],
      [],
      [
        {
          tier_id: 1,
          tier_name: 'A',
          min_amount: '1000',
          is_unit: 0,
          all_products: 0,
        },
      ],
      [{ product_code: 'P1' }],
      [],
      [],
    ]);
    const scope = await svc.scope(7, '2026-10-05', '2026-10-06');
    expect(scope.feature).toBe('wang_day');
    expect(scope.excluded_product_codes).toEqual([]);
    expect(query.mock.calls[5][1]).toEqual([
      7,
      '2026-10-04 17:00:00',
      '2026-10-06 16:59:59',
    ]);
  });
});
