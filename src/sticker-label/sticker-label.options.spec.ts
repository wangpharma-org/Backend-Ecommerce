import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import {
  enabledStickerLangs,
  hashStickerOptions,
  isStickerProCode,
  normalizeStickerOptions,
  packToCartUnit,
  stickerQuantity,
} from './sticker-label.options';

const ALL_LANGS = enabledStickerLangs('th,en,zh,ru,ar,my');

const base = {
  shopName: 'ร้านยาวังเภสัช',
  address: '123 ถ.สุขุมวิท',
  line3: 'เปิด 08:00-20:00 โทร 02-000-0000',
  lang: 'th',
  printMode: 'bw',
  packSize: '1',
};

describe('normalizeStickerOptions', () => {
  it('ยุบช่องว่าง และ bw ไม่เก็บสีแม้ client ส่งมา', () => {
    const result = normalizeStickerOptions(
      { ...base, shopName: '  ร้าน   ยา\n ดี ', color: '#ff0000' },
      ALL_LANGS,
    );
    expect(result.shopName).toBe('ร้าน ยา ดี');
    expect(result.color).toBeNull();
  });

  it('ชื่อร้านบังคับ', () => {
    expect(() =>
      normalizeStickerOptions({ ...base, shopName: '   ' }, ALL_LANGS),
    ).toThrow(BadRequestException);
  });

  it.each([
    ['shopName', 41],
    ['address', 56],
    ['line3', 41],
  ])('%s ยาวเกินกำหนดไม่ได้', (field, len) => {
    expect(() =>
      normalizeStickerOptions({ ...base, [field]: 'ก'.repeat(len) }, ALL_LANGS),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeStickerOptions(
        { ...base, [field]: 'ก'.repeat(len - 1) },
        ALL_LANGS,
      ),
    ).not.toThrow();
  });

  it('mode สีต้องมี hex และเก็บเป็นตัวพิมพ์ใหญ่', () => {
    expect(() =>
      normalizeStickerOptions({ ...base, printMode: 'color' }, ALL_LANGS),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeStickerOptions(
        { ...base, printMode: 'color', color: 'red' },
        ALL_LANGS,
      ),
    ).toThrow(BadRequestException);
    expect(
      normalizeStickerOptions(
        { ...base, printMode: 'color', color: '#1a2b3c' },
        ALL_LANGS,
      ).color,
    ).toBe('#1A2B3C');
  });

  it('ภาษาที่ยังไม่เปิดขายถูกปฏิเสธ', () => {
    expect(() =>
      normalizeStickerOptions({ ...base, lang: 'ar' }, ['th']),
    ).toThrow(/ยังไม่เปิดขาย/);
    expect(() =>
      normalizeStickerOptions({ ...base, lang: 'xx' }, ALL_LANGS),
    ).toThrow(BadRequestException);
  });

  it('packSize รับเฉพาะ 1/50 (ไม่หลุด prototype key)', () => {
    expect(
      normalizeStickerOptions({ ...base, packSize: 50 }, ALL_LANGS).packSize,
    ).toBe('50');
    for (const packSize of ['10', 'toString', null]) {
      expect(() =>
        normalizeStickerOptions({ ...base, packSize }, ALL_LANGS),
      ).toThrow(BadRequestException);
    }
  });
});

describe('hashStickerOptions', () => {
  it('รูปแบบเดียวกันได้ hash เดียวกัน ไม่ขึ้นกับลำดับ key / ช่องว่าง', () => {
    const a = normalizeStickerOptions(base, ALL_LANGS);
    const b = normalizeStickerOptions(
      {
        packSize: '1',
        printMode: 'bw',
        lang: 'th',
        line3: base.line3,
        address: ` ${base.address} `,
        shopName: base.shopName,
      },
      ALL_LANGS,
    );
    expect(hashStickerOptions(a)).toBe(hashStickerOptions(b));
  });

  it('รูปแบบต่างกันได้ hash ต่างกัน', () => {
    const a = normalizeStickerOptions(base, ALL_LANGS);
    const b = normalizeStickerOptions({ ...base, lang: 'en' }, ALL_LANGS);
    expect(hashStickerOptions(a)).not.toBe(hashStickerOptions(b));
  });
});

describe('packToCartUnit / stickerQuantity', () => {
  const units = [
    { unit_name: 'ดวง', ratio: 1, level: 1 },
    { unit_name: 'ม500ดวง', ratio: 500, level: 2 },
  ];

  it('50 แผ่นใช้หน่วย ม500ดวง', () => {
    expect(packToCartUnit('50', 3, units)).toEqual({
      unit_name: 'ม500ดวง',
      level: 2,
      amount: 3,
    });
  });

  it('1 แผ่นใช้หน่วยดวง × 10', () => {
    expect(packToCartUnit('1', 4, units)).toEqual({
      unit_name: 'ดวง',
      level: 1,
      amount: 40,
    });
  });

  it('ไม่มีหน่วยที่หารลงตัวต้อง error', () => {
    expect(() =>
      packToCartUnit('1', 1, [{ unit_name: 'ม500ดวง', ratio: 500, level: 2 }]),
    ).toThrow(BadRequestException);
  });

  it('คำนวณแผ่น/ดวงจาก amount × ratio', () => {
    expect(stickerQuantity(3, 500, '50')).toEqual({
      dots: 1500,
      sheets: 150,
      packs: 3,
    });
    expect(stickerQuantity(40, 1, '1')).toEqual({
      dots: 40,
      sheets: 4,
      packs: 4,
    });
  });
});

describe('isStickerProCode / enabledStickerLangs', () => {
  it('รู้จักเฉพาะ -05/-07', () => {
    expect(isStickerProCode('95030411-05')).toBe(true);
    expect(isStickerProCode('95030411-07')).toBe(true);
    expect(isStickerProCode('95030411-01')).toBe(false);
    expect(isStickerProCode(null)).toBe(false);
  });

  it('ไม่ตั้ง env = เปิดเฉพาะไทย', () => {
    expect(enabledStickerLangs('')).toEqual(['th']);
    expect(enabledStickerLangs(' en , ar,xx')).toEqual(['en', 'ar']);
  });
});

describe('ฉลาก 2 ภาษา (lang2)', () => {
  it('ไทย + อีก 1 ภาษาได้ · ไม่ส่ง lang2 = ภาษาเดียว (ไม่มีฟิลด์)', () => {
    expect(
      normalizeStickerOptions({ ...base, lang2: 'zh' }, ALL_LANGS).lang2,
    ).toBe('zh');
    expect('lang2' in normalizeStickerOptions(base, ALL_LANGS)).toBe(false);
    expect(
      'lang2' in normalizeStickerOptions({ ...base, lang2: '' }, ALL_LANGS),
    ).toBe(false);
  });

  it('ภาษาหลักต้องเป็นไทย และภาษาที่ 2 ต้องไม่ใช่ไทย/ต้องเปิดขาย', () => {
    expect(() =>
      normalizeStickerOptions({ ...base, lang: 'en', lang2: 'zh' }, ALL_LANGS),
    ).toThrow(/ไทย \+ อีก 1 ภาษา/);
    expect(() =>
      normalizeStickerOptions({ ...base, lang2: 'th' }, ALL_LANGS),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeStickerOptions({ ...base, lang2: 'jp' }, ALL_LANGS),
    ).toThrow(BadRequestException);
    expect(() =>
      normalizeStickerOptions({ ...base, lang2: 'ar' }, ['th']),
    ).toThrow(/ยังไม่เปิดขาย/);
  });

  it('hash: ภาษาเดียวเท่าเดิม · ใส่ lang2 แล้วเป็นคนละรูปแบบ', () => {
    const single = normalizeStickerOptions(base, ALL_LANGS);
    const bi = normalizeStickerOptions({ ...base, lang2: 'en' }, ALL_LANGS);
    expect(hashStickerOptions(single)).not.toBe(hashStickerOptions(bi));
    // canonical ของภาษาเดียวต้องเหมือนก่อนมี lang2 (แถวตะกร้าเดิมยังรวมจำนวนได้)
    expect(hashStickerOptions(single)).toBe(
      createHash('sha1')
        .update(
          JSON.stringify([
            single.shopName,
            single.address,
            single.line3,
            single.lang,
            single.printMode,
            single.color,
            single.packSize,
          ]),
        )
        .digest('hex'),
    );
  });
});

describe('ฟอนต์ของฉลาก', () => {
  it('รับเฉพาะฟอนต์ในรายการ · sarabun (ค่าเริ่มต้น) ไม่เก็บ', () => {
    expect(
      normalizeStickerOptions({ ...base, font: 'kanit' }, ALL_LANGS).font,
    ).toBe('kanit');
    expect(
      normalizeStickerOptions({ ...base, font: 'sarabun' }, ALL_LANGS),
    ).not.toHaveProperty('font');
    expect(
      normalizeStickerOptions({ ...base, font: '' }, ALL_LANGS),
    ).not.toHaveProperty('font');
    expect(() =>
      normalizeStickerOptions({ ...base, font: 'Comic Sans' }, ALL_LANGS),
    ).toThrow(BadRequestException);
  });

  it('hash ของรูปแบบเดิม (ไม่มี font) เท่า sarabun · ฟอนต์อื่นได้ hash ใหม่', () => {
    const plain = normalizeStickerOptions(base, ALL_LANGS);
    const sarabun = normalizeStickerOptions(
      { ...base, font: 'sarabun' },
      ALL_LANGS,
    );
    const kanit = normalizeStickerOptions(
      { ...base, font: 'kanit' },
      ALL_LANGS,
    );
    expect(hashStickerOptions(sarabun)).toBe(hashStickerOptions(plain));
    expect(hashStickerOptions(kanit)).not.toBe(hashStickerOptions(plain));
  });
});
