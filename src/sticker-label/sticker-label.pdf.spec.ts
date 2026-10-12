import {
  buildStickerSheetHtml,
  escapeHtml,
  fitFontSize,
  googleFontsCss,
  inkOf,
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
  it('A4 วางกลาง: ขอบ 25 × 23.5 มม. และเลื่อนปรับเทียบได้', () => {
    expect(sheetOrigin('')).toEqual({ left: 25, top: 23.5 });
    expect(sheetOrigin('1.5,-2')).toEqual({ left: 26.5, top: 21.5 });
    expect(sheetOrigin('x,y')).toEqual({ left: 25, top: 23.5 });
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
    expect(html).toContain('grid-template-rows:repeat(5,50mm)');
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
