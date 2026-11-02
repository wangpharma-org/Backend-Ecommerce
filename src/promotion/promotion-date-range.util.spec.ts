import { BadRequestException } from '@nestjs/common';
import { toPromotionDateRange } from './promotion-date-range.util';

describe('toPromotionDateRange', () => {
  it('same-day promo covers 00:00:00–23:59:59 Bangkok time', () => {
    const range = toPromotionDateRange('2026-10-12', '2026-10-12');
    expect(range.start_date.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    expect(range.end_date.toISOString()).toBe('2026-10-12T16:59:59.000Z');
  });

  it('multi-day promo starts at first-day midnight and ends at last-day 23:59:59', () => {
    const range = toPromotionDateRange('2026-08-12', '2026-08-15');
    expect(range.start_date.toISOString()).toBe('2026-08-11T17:00:00.000Z');
    expect(range.end_date.toISOString()).toBe('2026-08-15T16:59:59.000Z');
  });

  it('reads ISO strings with an offset as an instant, not a Bangkok wall time', () => {
    // 2026-10-11T17:00:00Z = 12/10 00:00 Bangkok — เดิมได้วันที่ 11
    const range = toPromotionDateRange(
      '2026-10-11T17:00:00.000Z',
      '2026-10-12T16:59:59.000Z',
    );
    expect(range.start_date.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    expect(range.end_date.toISOString()).toBe('2026-10-12T16:59:59.000Z');
  });

  it('accepts Date objects', () => {
    const range = toPromotionDateRange(
      new Date('2026-10-12T00:00:00.000Z'),
      new Date('2026-10-12T00:00:00.000Z'),
    );
    expect(range.start_date.toISOString()).toBe('2026-10-11T17:00:00.000Z');
    expect(range.end_date.toISOString()).toBe('2026-10-12T16:59:59.000Z');
  });

  it('rejects an end date before the start date', () => {
    expect(() => toPromotionDateRange('2026-10-13', '2026-10-12')).toThrow(
      BadRequestException,
    );
  });

  it('rejects missing or unparseable dates instead of crashing', () => {
    expect(() => toPromotionDateRange('abc', '2026-10-12')).toThrow(
      BadRequestException,
    );
    expect(() => toPromotionDateRange('2026-10-12', undefined)).toThrow(
      BadRequestException,
    );
    expect(() => toPromotionDateRange('', '')).toThrow(BadRequestException);
  });
});
