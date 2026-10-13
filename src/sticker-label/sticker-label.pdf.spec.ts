import {
  buildStickerSheetHtml,
  escapeHtml,
  fitFontSize,
  googleFontsCss,
  inkOf,
  sheetGap,
  sheetOrigin,
  STICKER_FORM_TEXT,
} from './sticker-label.pdf';
import type { StickerOrderSnapshot } from './sticker-label.options';

const snapshot = (
  over: Partial<StickerOrderSnapshot> = {},
): StickerOrderSnapshot => ({
  shopName: 'ร้านยาทดสอบ',
  address: '123 ถ.ทดสอบ',
  line3: 'โทร 02-000-0000',
  lang: 'th',
  printMode: 'bw',
  color: null,
  packSize: '1',
  sheets: 1,
  dots: 10,
  ...over,
});

describe('sticker-label.pdf', () => {
  it('ระยะห่างระหว่างดวงตั้งต้น 3 มม. ปรับได้ และไม่ให้ล้นหน้า', () => {
    expect(sheetGap('')).toEqual({ x: 3, y: 3 });
    expect(sheetGap('5')).toEqual({ x: 5, y: 5 });
    expect(sheetGap('4,2')).toEqual({ x: 4, y: 2 });
    expect(sheetGap('0,30')).toEqual({ x: 0, y: 11.75 });
    expect(sheetGap('-1,x')).toEqual({ x: 0, y: 0 });
  });

  it('A4 วางกลางตามระยะห่าง และเลื่อนปรับเทียบได้', () => {
    const g3 = { x: 3, y: 3 };
    // 2×80 + 3 = 163 → ขอบซ้าย 23.5 · 5×50 + 4×3 = 262 → ขอบบน 17.5
    expect(sheetOrigin('', g3)).toEqual({ left: 23.5, top: 17.5 });
    expect(sheetOrigin('1.5,-2', g3)).toEqual({ left: 25, top: 15.5 });
    expect(sheetOrigin('x,y', { x: 0, y: 0 })).toEqual({ left: 25, top: 23.5 });
  });

  it('ขาวดำบังคับดำ · สีใช้ hex ที่เลือก', () => {
    expect(inkOf({ printMode: 'bw', color: '#FF0000' })).toBe('#000000');
    expect(inkOf({ printMode: 'color', color: '#C0392B' })).toBe('#C0392B');
    expect(inkOf({ printMode: 'color', color: 'red;}' })).toBe('#000000');
  });

  it('ย่อฟอนต์เฉพาะบรรทัดที่ยาวเกิน ไม่ต่ำกว่า 7px', () => {
    expect(fitFontSize(30, 11, 40)).toBe(11);
    expect(fitFontSize(80, 11, 40)).toBe(7);
    expect(fitFontSize(50, 11, 40)).toBe(8.8);
  });

  it('1 หน้า = 10 ดวง และจำนวนหน้าตาม pages ของแต่ละงาน', () => {
    const html = buildStickerSheetHtml(
      [
        { snapshot: snapshot(), pages: 2 },
        {
          snapshot: snapshot({ printMode: 'color', color: '#1A2B3C' }),
          pages: 1,
        },
      ],
      { googleFonts: false },
    );
    expect(html.match(/<section class="sheet"/g)).toHaveLength(3);
    expect(html.match(/<div class="label"/g)).toHaveLength(30);
    expect(html).toContain('color:#1A2B3C');
    expect(html).toContain('grid-template-columns:repeat(2,80mm)');
    expect(html).toContain(
      'grid-template-rows:repeat(5,50mm);column-gap:3mm;row-gap:3mm',
    );
    expect(html).toContain("font-family:'Sarabun'");
  });

  it('ข้อความลูกค้าถูก escape (กัน HTML injection ใน Chrome)', () => {
    const html = buildStickerSheetHtml(
      [
        {
          snapshot: snapshot({ shopName: '<img src=x onerror=alert(1)>' }),
          pages: 1,
        },
      ],
      { googleFonts: false },
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`"'&`)).toBe('&quot;&#39;&amp;');
  });

  it('อาหรับเป็น rtl และใช้คำแปลของภาษานั้น', () => {
    const html = buildStickerSheetHtml(
      [{ snapshot: snapshot({ lang: 'ar' }), pages: 1 }],
      { googleFonts: false },
    );
    expect(html).toContain('lang="ar" dir="rtl"');
    expect(html).toContain(STICKER_FORM_TEXT.ar.patient);
  });

  it('คำแปลครบทุก key ทุกภาษา', () => {
    const keys = Object.keys(STICKER_FORM_TEXT.th).sort();
    for (const t of Object.values(STICKER_FORM_TEXT)) {
      expect(Object.keys(t).sort()).toEqual(keys);
    }
  });
});

describe('googleFontsCss', () => {
  it('ไทย/อังกฤษไม่โหลดฟอนต์ภายนอก · ภาษาอื่นโหลดเฉพาะที่ใช้', () => {
    expect(googleFontsCss(['th', 'en'])).toBeNull();
    const href = googleFontsCss(['ar', 'th', 'ar']) ?? '';
    expect(href).toContain('family=Noto+Sans+Arabic');
    expect(href).not.toContain('Noto+Sans+SC');
  });
});

describe('PDF ฉลาก 2 ภาษา', () => {
  it('ภาษาที่ 2 ต่อท้ายในบรรทัดเดียวกัน + โหลดฟอนต์ของภาษาที่ 2', () => {
    const html = buildStickerSheetHtml(
      [{ snapshot: snapshot({ lang2: 'zh' }), pages: 1 }],
      {},
    );
    expect(html).toContain('class="label bi"');
    expect(html).toContain(
      `ชื่อคนไข้ <bdi class="l2" lang="zh" dir="auto">${STICKER_FORM_TEXT.zh.patient}</bdi>`,
    );
    expect(html).toContain('family=Noto+Sans+SC');
  });

  it('lang2 ใช้ได้เฉพาะภาษาหลักไทย และข้ามคำที่ภาษาที่ 2 ไม่มี', () => {
    expect(
      buildStickerSheetHtml(
        [{ snapshot: snapshot({ lang: 'en', lang2: 'zh' }), pages: 1 }],
        { googleFonts: false },
      ),
    ).not.toContain('class="l2"');
    // อังกฤษไม่มีคำ "วันละ" (perDay = '') → ไม่มี bdi ว่าง
    const html = buildStickerSheetHtml(
      [{ snapshot: snapshot({ lang2: 'en' }), pages: 1 }],
      { googleFonts: false },
    );
    expect(html).not.toContain('<bdi class="l2" lang="en" dir="auto"></bdi>');
  });
});
