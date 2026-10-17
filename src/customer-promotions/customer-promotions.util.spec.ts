import {
  MAX_PRO_CODES,
  bangkokToday,
  hhmm,
  isDateInRange,
  matchedProCodes,
  num,
  parseProCodes,
  rebateSeason,
  unitNameOf,
} from './customer-promotions.util';

describe('customer-promotions util', () => {
  describe('parseProCodes', () => {
    it('ว่าง = []', () => {
      expect(parseProCodes(undefined)).toEqual({ ok: true, codes: [] });
      expect(parseProCodes('')).toEqual({ ok: true, codes: [] });
    });
    it('ตัดช่องว่าง ตัดซ้ำ คงลำดับ', () => {
      expect(parseProCodes(' A1, B2 ,A1,,C-3')).toEqual({
        ok: true,
        codes: ['A1', 'B2', 'C-3'],
      });
    });
    it(`เกิน ${MAX_PRO_CODES} รหัส = ไม่ผ่าน`, () => {
      const raw = Array.from(
        { length: MAX_PRO_CODES + 1 },
        (_, i) => `P${i}`,
      ).join(',');
      expect(parseProCodes(raw).ok).toBe(false);
      const ok = Array.from({ length: MAX_PRO_CODES }, (_, i) => `P${i}`).join(
        ',',
      );
      expect(parseProCodes(ok).ok).toBe(true);
    });
    it('รูปแบบผิด = ไม่ผ่าน', () => {
      expect(parseProCodes("A1,B'2").ok).toBe(false);
      expect(parseProCodes(['A1']).ok).toBe(false);
    });
  });

  describe('matchedProCodes', () => {
    const requested = ['A', 'B', 'C'];
    it('ขั้นปกติ: เฉพาะสินค้าในเงื่อนไข', () => {
      expect(
        matchedProCodes(
          requested,
          { allProducts: false },
          new Set(['C', 'A', 'Z']),
          new Set(),
        ),
      ).toEqual(['A', 'C']);
    });
    it('ขั้นปกติ: ไม่สนรายการยกเว้น', () => {
      expect(
        matchedProCodes(
          requested,
          { allProducts: false },
          new Set(['B']),
          new Set(['B']),
        ),
      ).toEqual(['B']);
    });
    it('all_products: ทุกตัว ยกเว้นที่ถูกยกเว้น', () => {
      expect(
        matchedProCodes(
          requested,
          { allProducts: true },
          new Set(),
          new Set(['B']),
        ),
      ).toEqual(['A', 'C']);
    });
    it('ไม่ได้ส่งสินค้ามา = []', () => {
      expect(
        matchedProCodes([], { allProducts: true }, new Set(), new Set()),
      ).toEqual([]);
    });
  });

  describe('isDateInRange', () => {
    it('รวมวันแรกและวันสุดท้าย', () => {
      expect(isDateInRange('2026-10-01', '2026-10-01', '2026-10-31')).toBe(
        true,
      );
      expect(isDateInRange('2026-10-31', '2026-10-01', '2026-10-31')).toBe(
        true,
      );
      expect(isDateInRange('2026-11-01', '2026-10-01', '2026-10-31')).toBe(
        false,
      );
      expect(isDateInRange('2026-09-30', '2026-10-01', '2026-10-31')).toBe(
        false,
      );
    });
    it('null = ไม่จำกัดฝั่งนั้น · รับค่ามีเวลาต่อท้าย', () => {
      expect(isDateInRange('2026-10-17', null, null)).toBe(true);
      expect(isDateInRange('2026-10-17', null, '2026-10-17T00:00:00')).toBe(
        true,
      );
      expect(isDateInRange('2026-10-17', '2026-10-18', undefined)).toBe(false);
    });
  });

  describe('bangkokToday', () => {
    it('ใช้เวลาไทย ไม่ใช่ UTC', () => {
      // 17 ต.ค. 18:30 UTC = 18 ต.ค. 01:30 เวลาไทย
      expect(bangkokToday(new Date('2026-10-17T18:30:00Z'))).toBe('2026-10-18');
      expect(bangkokToday(new Date('2026-10-17T16:59:59Z'))).toBe('2026-10-17');
    });
  });

  describe('rebateSeason', () => {
    it('เม.ย.–ธ.ค. = ฤดูของปีนั้น 9 เดือน', () => {
      const s = rebateSeason(new Date('2026-10-17T05:00:00Z'));
      expect(s.seasonStart).toBe('2026-04-01');
      expect(s.seasonEnd).toBe('2026-12-31');
      expect(s.months).toHaveLength(9);
      expect(s.months[0]).toEqual({ month: '2026-04', monthNumber: 4 });
      expect(s.months[8]).toEqual({ month: '2026-12', monthNumber: 12 });
    });
    it('ม.ค.–มี.ค. = ฤดูของปีก่อน', () => {
      expect(rebateSeason(new Date('2027-02-10T05:00:00Z')).seasonStart).toBe(
        '2026-04-01',
      );
    });
    it('ขอบเดือนใช้เวลาไทย (31 มี.ค. 17:30 UTC = 1 เม.ย. ไทย)', () => {
      expect(rebateSeason(new Date('2027-03-31T17:30:00Z')).seasonStart).toBe(
        '2027-04-01',
      );
    });
  });

  it('hhmm / unitNameOf / num', () => {
    expect(hhmm('09:30:00')).toBe('09:30');
    expect(hhmm(null)).toBe('');
    const units = [
      { level: 1, unit_name: 'กล่อง' },
      { level: 2, unit_name: 'แผง' },
    ];
    expect(unitNameOf('2', units)).toBe('แผง');
    expect(unitNameOf(3, units)).toBe('');
    expect(unitNameOf('1', undefined)).toBe('');
    expect(num('1234.50')).toBe(1234.5);
    expect(num('abc')).toBe(0);
    expect(num(null)).toBe(0);
  });
});
