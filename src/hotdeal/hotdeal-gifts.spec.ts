import {
  computeHotdealGifts,
  HotdealGiftDeal,
  INTERNAL_HOTDEAL_GIFTS_MAX_LINES,
  parseHotdealGiftLines,
} from './hotdeal-gifts';

const deal = (over: Partial<HotdealGiftDeal> = {}): HotdealGiftDeal => ({
  pro_code: 'A',
  units: [
    { level: 1, unit_name: 'ชิ้น', ratio: 1 },
    { level: 2, unit_name: 'กล่อง', ratio: 10 },
  ],
  pro1_amount: '2',
  pro1_unit: '2',
  gift_pro_code: 'G',
  gift_pro_name: 'ของแถม',
  gift_units: [{ level: 1, unit_name: 'ซอง', ratio: 1 }],
  pro2_amount: '3',
  pro2_unit: '1',
  ...over,
});

describe('computeHotdealGifts', () => {
  it('ไม่ถึงจำนวนซื้อของดีล → ไม่มีของแถม', () => {
    const result = computeHotdealGifts(
      [{ pro_code: 'A', unit: 'กล่อง', amount: 1 }],
      [deal()],
    );
    expect(result).toEqual({ gifts: [], skipped: [] });
  });

  it('รวมทุกบรรทัดของสินค้าเดียวกันในหน่วยเล็กสุดก่อนนับชุด', () => {
    // 3 กล่อง (30) + 15 ชิ้น = 45 ชิ้น, ดีล 2 กล่อง = 20 ชิ้น → 2 ชุด → แถม 6
    const result = computeHotdealGifts(
      [
        { pro_code: 'A', unit: 'กล่อง', amount: 3 },
        { pro_code: 'A', unit: 'ชิ้น', amount: 15 },
        { pro_code: 'B', unit: 'ชิ้น', amount: 99 },
      ],
      [deal()],
    );
    expect(result.gifts).toEqual([
      {
        main_pro_code: 'A',
        pro_code: 'G',
        pro_name: 'ของแถม',
        amount: 6,
        unit: 'ซอง',
        sets: 2,
        buy_amount: 2,
        buy_unit: 'กล่อง',
        gift_amount: 3,
      },
    ]);
  });

  it('หน่วยของดีลที่เก็บเป็นชื่อหน่วย (แถวเก่า) ใช้ได้เหมือนระดับ', () => {
    const result = computeHotdealGifts(
      [{ pro_code: 'A', unit: 'กล่อง', amount: 2 }],
      [deal({ pro1_unit: 'กล่อง', pro2_unit: 'ซอง' })],
    );
    expect(result.gifts[0]).toMatchObject({ amount: 3, sets: 1 });
  });

  it('หน่วยที่ไม่ใช่ของสินค้า → ไม่นับบรรทัดนั้นและรายงานไว้', () => {
    const result = computeHotdealGifts(
      [
        { pro_code: 'A', unit: 'ลัง', amount: 50 },
        { pro_code: 'A', unit: 'กล่อง', amount: 2 },
      ],
      [deal()],
    );
    expect(result.gifts[0]).toMatchObject({ amount: 3, sets: 1 });
    expect(result.skipped).toEqual([
      { pro_code: 'A', unit: 'ลัง', reason: 'unknown_unit' },
    ]);
  });

  it('ดีลที่จำนวนเป็น 0 หรือหาหน่วยไม่เจอ → ข้ามทั้งดีล ไม่หารด้วยศูนย์', () => {
    const lines = [{ pro_code: 'A', unit: 'กล่อง', amount: 5 }];
    for (const bad of [
      deal({ pro1_amount: '0' }),
      deal({ pro2_amount: 'x' }),
      deal({ pro1_unit: '3' }),
      deal({ gift_units: [] }),
    ]) {
      expect(computeHotdealGifts(lines, [bad])).toEqual({
        gifts: [],
        skipped: [{ pro_code: 'A', unit: '', reason: 'invalid_deal' }],
      });
    }
  });
});

describe('parseHotdealGiftLines', () => {
  it('ตัดช่องว่างและคืนบรรทัดที่ใช้ได้', () => {
    expect(
      parseHotdealGiftLines({
        items: [{ pro_code: ' A ', unit: ' กล่อง ', amount: '2' }],
      }),
    ).toEqual([{ pro_code: 'A', unit: 'กล่อง', amount: 2 }]);
    expect(parseHotdealGiftLines({ items: [] })).toEqual([]);
  });

  it('รูปแบบผิด → null', () => {
    const tooMany = Array.from(
      { length: INTERNAL_HOTDEAL_GIFTS_MAX_LINES + 1 },
      () => ({ pro_code: 'A', unit: 'ชิ้น', amount: 1 }),
    );
    for (const body of [
      null,
      {},
      { items: 'A' },
      { items: [null] },
      { items: [{ pro_code: '', unit: 'ชิ้น', amount: 1 }] },
      { items: [{ pro_code: 'A', unit: 'ชิ้น', amount: 0 }] },
      { items: [{ pro_code: 'A', unit: 'ชิ้น', amount: 'x' }] },
      { items: tooMany },
    ]) {
      expect(parseHotdealGiftLines(body)).toBeNull();
    }
  });
});
