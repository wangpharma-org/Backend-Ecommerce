import {
  esWindowFor,
  isExactCodeMatch,
  mergeSearchPage,
  SEARCH_PIN_LIMIT,
  splitExtraCandidates,
} from './search-merge.util';

describe('search-merge.util (ECWC-751)', () => {
  describe('isExactCodeMatch', () => {
    it('ตรงรหัสหรือบาร์โค้ดแบบไม่สนตัวพิมพ์/ช่องว่าง', () => {
      expect(isExactCodeMatch('ab01', { pro_code: 'AB01' })).toBe(true);
      expect(
        isExactCodeMatch(' 885000 ', {
          pro_code: 'X',
          pro_barcode2: '885000',
        }),
      ).toBe(true);
    });

    it('บางส่วนไม่นับ และ keyword ว่างไม่ตรงอะไร', () => {
      expect(isExactCodeMatch('AB', { pro_code: 'AB01' })).toBe(false);
      expect(isExactCodeMatch('  ', { pro_code: '' })).toBe(false);
      expect(
        isExactCodeMatch('null', { pro_code: 'X', pro_barcode1: null }),
      ).toBe(false);
    });
  });

  describe('splitExtraCandidates', () => {
    it('ตัดตัวที่ ES เจอแล้วและตัวซ้ำออก แยกตัวตรงเป๊ะเป็น pinned', () => {
      const result = splitExtraCandidates(
        '885',
        [
          { pro_code: 'A' },
          { pro_code: 'B', pro_barcode1: '885' },
          { pro_code: 'A' },
          { pro_code: 'C' },
          { pro_code: 'D' },
        ],
        new Set(['C']),
      );
      expect(result).toEqual({ pinned: ['B'], rest: ['A', 'D'] });
    });

    it('pinned ไม่เกิน SEARCH_PIN_LIMIT ที่เหลือไปอยู่ rest', () => {
      const rows = Array.from({ length: SEARCH_PIN_LIMIT + 2 }, (_, i) => ({
        pro_code: `P${i}`,
        pro_barcode1: 'X1',
      }));
      const result = splitExtraCandidates('x1', rows, new Set());
      expect(result.pinned).toHaveLength(SEARCH_PIN_LIMIT);
      expect(result.rest).toEqual(['P5', 'P6']);
    });
  });

  describe('esWindowFor', () => {
    it('ถอยหลังเผื่อ pinned แต่ไม่ติดลบ', () => {
      expect(esWindowFor(0, 15)).toEqual({ from: 0, size: 15 });
      expect(esWindowFor(3, 10)).toEqual({ from: 0, size: 13 });
      expect(esWindowFor(40, 20)).toEqual({ from: 35, size: 25 });
    });
  });

  describe('mergeSearchPage', () => {
    // ทั้งหมดเสมือน: pinned[P1,P2] + es[E0..E9] + rest[R0..R2] = 15
    const esAll = Array.from({ length: 10 }, (_, i) => `E${i}`);
    const page = (offset: number, limit: number) => {
      const { from, size } = esWindowFor(offset, limit);
      return mergeSearchPage({
        pinned: ['P1', 'P2'],
        esCodes: esAll.slice(from, from + size),
        esFrom: from,
        esTotal: esAll.length,
        rest: ['R0', 'R1', 'R2'],
        offset,
        limit,
      });
    };

    it('หน้าแรก: pinned ขึ้นก่อน ตามด้วย ES', () => {
      expect(page(0, 5)).toEqual({
        codes: ['P1', 'P2', 'E0', 'E1', 'E2'],
        totalCount: 15,
      });
    });

    it('ทุกหน้าต่อกันครบ ไม่ซ้ำ ไม่หาย', () => {
      const all = [...page(0, 4).codes, ...page(4, 4).codes];
      all.push(...page(8, 4).codes, ...page(12, 4).codes);
      expect(all).toEqual(['P1', 'P2', ...esAll, 'R0', 'R1', 'R2']);
    });

    it('ES ล่ม (esTotal 0) ได้ pinned + rest อย่างเดียว', () => {
      expect(
        mergeSearchPage({
          pinned: ['P1'],
          esCodes: [],
          esFrom: 0,
          esTotal: 0,
          rest: ['R0'],
          offset: 0,
          limit: 10,
        }),
      ).toEqual({ codes: ['P1', 'R0'], totalCount: 2 });
    });

    it('offset เกินจำนวนทั้งหมดได้หน้าว่าง', () => {
      expect(page(100, 10)).toEqual({ codes: [], totalCount: 15 });
    });
  });
});
