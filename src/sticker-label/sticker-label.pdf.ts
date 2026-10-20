import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  StickerLang,
  StickerOrderSnapshot,
} from './sticker-label.options';

/**
 * ECWC-704 แผ่นพิมพ์สติ๊กเกอร์ — 1 หน้า A4 = 1 แผ่น = 10 ดวง (2 × 5)
 * ดวงละ 80 × 50 มม. เว้นระยะระหว่างดวง 3 มม. (ปรับได้) และอยู่กลางหน้า
 * ฟอร์มและคำแปลตาม design canvas "แก้ไขชื่อฉลากยา" (PrintSheet)
 * คำแปลทุกภาษาต้องผ่านเภสัชกร/เจ้าของภาษา (ECWC-705) ก่อนเปิดขายภาษานั้น
 */

export const SHEET = {
  pageW: 210,
  pageH: 297,
  cols: 2,
  rows: 5,
  labelW: 80,
  labelH: 50,
} as const;

const DEFAULT_GAP_MM = 3;

function parsePair(raw: string | undefined): [number | null, number | null] {
  const [a, b] = (raw ?? '').split(',').map((v) => {
    const n = Number(v.trim());
    return v.trim() !== '' && Number.isFinite(n) ? n : null;
  });
  return [a ?? null, b ?? null];
}

/**
 * ระยะห่างระหว่างดวง (มม.) — STICKER_PDF_GAP_MM="แนวนอน,แนวตั้ง" ค่าเดียว = ใช้ทั้งสองแนว
 * จำกัดไม่ให้ดวงล้นหน้า A4 (แนวตั้งได้สูงสุด 11.75 มม.)
 */
export function sheetGap(
  rawGap: string | undefined = process.env.STICKER_PDF_GAP_MM,
): { x: number; y: number } {
  const [a, b] = parsePair(rawGap);
  const gx = a ?? DEFAULT_GAP_MM;
  const gy = b ?? a ?? DEFAULT_GAP_MM;
  const maxX = (SHEET.pageW - SHEET.cols * SHEET.labelW) / (SHEET.cols - 1);
  const maxY = (SHEET.pageH - SHEET.rows * SHEET.labelH) / (SHEET.rows - 1);
  const clamp = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return { x: clamp(gx, maxX), y: clamp(gy, maxY) };
}

/** ระยะขอบเมื่อวางกลางหน้า — ปรับเทียบเครื่องพิมพ์ได้ด้วย STICKER_PDF_OFFSET_MM="x,y" */
export function sheetOrigin(
  rawOffset: string | undefined = process.env.STICKER_PDF_OFFSET_MM,
  gap: { x: number; y: number } = sheetGap(),
): { left: number; top: number } {
  const [dx, dy] = parsePair(rawOffset);
  const gridW = SHEET.cols * SHEET.labelW + (SHEET.cols - 1) * gap.x;
  const gridH = SHEET.rows * SHEET.labelH + (SHEET.rows - 1) * gap.y;
  return {
    left: (SHEET.pageW - gridW) / 2 + (dx ?? 0),
    top: (SHEET.pageH - gridH) / 2 + (dy ?? 0),
  };
}

interface LangStyle {
  dir: 'ltr' | 'rtl';
  font: string;
  size: number;
  lh: number;
}

/** ฉลาก 2 ภาษา: ข้อความยาวขึ้นเกือบเท่าตัว จึงย่อฟอนต์ทั้งดวง */
const BILINGUAL = { size: 7.6, lh: 1.3 } as const;

const LANG_STYLE: Record<StickerLang, LangStyle> = {
  th: { dir: 'ltr', font: "'Sarabun'", size: 10.5, lh: 1.32 },
  en: { dir: 'ltr', font: "'Sarabun'", size: 10.5, lh: 1.32 },
  zh: {
    dir: 'ltr',
    font: "'Noto Sans SC','Noto Sans CJK SC'",
    size: 9.5,
    lh: 1.38,
  },
  ru: { dir: 'ltr', font: "'Noto Sans'", size: 9, lh: 1.32 },
  ar: { dir: 'rtl', font: "'Noto Sans Arabic'", size: 9.5, lh: 1.38 },
  my: { dir: 'ltr', font: "'Noto Sans Myanmar'", size: 8.5, lh: 1.5 },
};

type FormText = Record<
  | 'patient'
  | 'date'
  | 'drug'
  | 'indication'
  | 'take'
  | 'tab'
  | 'ml'
  | 'tsp'
  | 'tbsp'
  | 'before'
  | 'after'
  | 'perDay'
  | 'times'
  | 'morning'
  | 'noon'
  | 'evening'
  | 'bedtime'
  | 'every'
  | 'hrs'
  | 'rightAfter'
  | 'drowsy'
  | 'finish',
  string
>;

export const STICKER_FORM_TEXT: Record<StickerLang, FormText> = {
  th: {
    patient: 'ชื่อคนไข้',
    date: 'วันที่',
    drug: 'ชื่อยา',
    indication: 'ข้อบ่งใช้',
    take: 'รับประทานครั้งละ',
    tab: 'เม็ด',
    ml: 'ซีซี',
    tsp: 'ช้อนชา',
    tbsp: 'ช้อนโต๊ะ',
    before: 'ก่อนอาหาร',
    after: 'หลังอาหาร',
    perDay: 'วันละ',
    times: 'ครั้ง',
    morning: 'เช้า',
    noon: 'กลางวัน',
    evening: 'เย็น',
    bedtime: 'ก่อนนอน',
    every: 'หรือทุก',
    hrs: 'ชม. เมื่อมีอาการ',
    rightAfter: 'ทานยาหลังอาหารทันที',
    drowsy: 'ทานแล้วอาจจะทำให้ง่วงนอน',
    finish: 'ทานต่อเนื่องจนยาหมด',
  },
  en: {
    patient: 'Patient',
    date: 'Date',
    drug: 'Drug',
    indication: 'For',
    take: 'Take',
    tab: 'Tablet',
    ml: 'mL',
    tsp: 'Teaspoon',
    tbsp: 'Tablespoon',
    before: 'Before meals',
    after: 'After meals',
    perDay: '',
    times: 'times a day',
    morning: 'Morning',
    noon: 'Noon',
    evening: 'Evening',
    bedtime: 'Bedtime',
    every: 'Or every',
    hrs: 'hrs as needed',
    rightAfter: 'Right after meals',
    drowsy: 'May cause drowsiness',
    finish: 'Finish all medicine',
  },
  zh: {
    patient: '患者姓名',
    date: '日期',
    drug: '药名',
    indication: '适应症',
    take: '每次服用',
    tab: '片',
    ml: '毫升',
    tsp: '茶匙',
    tbsp: '汤匙',
    before: '饭前',
    after: '饭后',
    perDay: '每日',
    times: '次',
    morning: '早上',
    noon: '中午',
    evening: '晚上',
    bedtime: '睡前',
    every: '或每',
    hrs: '小时（有症状时）',
    rightAfter: '饭后立即服用',
    drowsy: '服用后可能引起嗜睡',
    finish: '请持续服用至药物用完',
  },
  ru: {
    patient: 'Пациент',
    date: 'Дата',
    drug: 'Препарат',
    indication: 'Показание',
    take: 'Принимать по',
    tab: 'табл.',
    ml: 'мл',
    tsp: 'ч. л.',
    tbsp: 'ст. л.',
    before: 'До еды',
    after: 'После еды',
    perDay: '',
    times: 'раз в день',
    morning: 'Утром',
    noon: 'Днём',
    evening: 'Вечером',
    bedtime: 'Перед сном',
    every: 'Или каждые',
    hrs: 'ч. при симптомах',
    rightAfter: 'Сразу после еды',
    drowsy: 'Может вызывать сонливость',
    finish: 'Принимать до окончания курса',
  },
  ar: {
    patient: 'اسم المريض',
    date: 'التاريخ',
    drug: 'اسم الدواء',
    indication: 'دواعي الاستعمال',
    take: 'الجرعة',
    tab: 'قرص',
    ml: 'مل',
    tsp: 'ملعقة صغيرة',
    tbsp: 'ملعقة كبيرة',
    before: 'قبل الأكل',
    after: 'بعد الأكل',
    perDay: '',
    times: 'مرات يومياً',
    morning: 'صباحاً',
    noon: 'ظهراً',
    evening: 'مساءً',
    bedtime: 'قبل النوم',
    every: 'أو كل',
    hrs: 'ساعات عند اللزوم',
    rightAfter: 'بعد الأكل مباشرة',
    drowsy: 'قد يسبب النعاس',
    finish: 'استمر حتى نفاد الدواء',
  },
  my: {
    patient: 'လူနာအမည်',
    date: 'ရက်စွဲ',
    drug: 'ဆေးအမည်',
    indication: 'အသုံးပြုရန်',
    take: 'တစ်ကြိမ်လျှင်',
    tab: 'လုံး',
    ml: 'စီစီ',
    tsp: 'လက်ဖက်ရည်ဇွန်း',
    tbsp: 'စားပွဲဇွန်း',
    before: 'ထမင်းမစားမီ',
    after: 'ထမင်းစားပြီး',
    perDay: 'တစ်နေ့',
    times: 'ကြိမ်',
    morning: 'မနက်',
    noon: 'နေ့လယ်',
    evening: 'ညနေ',
    bedtime: 'အိပ်ရာဝင်ချိန်',
    every: 'သို့မဟုတ်',
    hrs: 'နာရီခြား (လက္ခဏာရှိလျှင်)',
    rightAfter: 'ထမင်းစားပြီးချက်ချင်း',
    drowsy: 'အိပ်ငိုက်စေနိုင်သည်',
    finish: 'ဆေးကုန်သည်အထိ ဆက်သောက်ပါ',
  },
};

/** หัวฉลากใช้ฟอนต์ไทยก่อนเสมอ (ชื่อร้านส่วนใหญ่เป็นภาษาไทย) แล้ว fallback ตามอักษร */
const HEAD_FONT =
  "'Sarabun','Noto Sans','Noto Sans SC','Noto Sans CJK SC','Noto Sans Arabic','Noto Sans Myanmar',sans-serif";

/** Google Fonts ของภาษาที่ Sarabun ไม่ครอบคลุม — ไทย/อังกฤษไม่ต้องโหลดอะไร */
const GOOGLE_FONT_FAMILY: Partial<Record<StickerLang, string>> = {
  ru: 'Noto+Sans',
  zh: 'Noto+Sans+SC',
  ar: 'Noto+Sans+Arabic',
  my: 'Noto+Sans+Myanmar',
};

/**
 * โหลดเฉพาะฟอนต์ของภาษาที่อยู่ในเอกสาร (Noto SC ใหญ่มาก โหลดทุกภาษาจะช้า)
 * server ไม่มีเน็ตจะ fallback ไปฟอนต์ Noto ที่ลงในเครื่อง (Dockerfile)
 */
export function googleFontsCss(langs: StickerLang[]): string | null {
  const families = [...new Set(langs.map((l) => GOOGLE_FONT_FAMILY[l]))]
    .filter(Boolean)
    .map((f) => `family=${f}:wght@400;700`);
  if (families.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=block`;
}

let sarabunCss: string | null = null;
/** ฝัง Sarabun เป็น base64 — ภาษาไทยไม่ต้องพึ่งเน็ต */
function sarabunFontFace(): string {
  if (sarabunCss) return sarabunCss;
  const face = (file: string, weight: number) => {
    const data = readFileSync(join(__dirname, 'fonts', file)).toString(
      'base64',
    );
    return `@font-face{font-family:'Sarabun';font-weight:${weight};font-style:normal;src:url(data:font/ttf;base64,${data}) format('truetype');}`;
  };
  sarabunCss = face('Sarabun-Regular.ttf', 400) + face('Sarabun-Bold.ttf', 700);
  return sarabunCss;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** ข้อความยาวเกินกำหนดย่อฟอนต์เฉพาะบรรทัดนั้น (ไม่ต่ำกว่า 7px) */
export function fitFontSize(len: number, base: number, max: number): number {
  return len <= max
    ? base
    : Math.max(7, Math.round(((base * max) / len) * 10) / 10);
}

/** ขาวดำบังคับดำ · สีใช้ hex ที่ลูกค้าเลือก (ผ่าน validate แล้วตอนใส่ตะกร้า) */
export function inkOf(
  snapshot: Pick<StickerOrderSnapshot, 'printMode' | 'color'>,
): string {
  if (
    snapshot.printMode === 'color' &&
    /^#[0-9A-Fa-f]{6}$/.test(snapshot.color ?? '')
  ) {
    return snapshot.color as string;
  }
  return '#000000';
}

function labelHtml(snapshot: StickerOrderSnapshot): string {
  const lang: StickerLang = STICKER_FORM_TEXT[snapshot.lang]
    ? snapshot.lang
    : 'th';
  const style = LANG_STYLE[lang];
  const t = STICKER_FORM_TEXT[lang];
  // ฉลาก 2 ภาษา: ภาษาที่ 2 ตัวเล็กกว่าต่อท้ายในบรรทัดเดียวกัน (bdi กันอาหรับสลับลำดับคำไทย)
  const lang2 =
    lang === 'th' && snapshot.lang2 && STICKER_FORM_TEXT[snapshot.lang2]
      ? snapshot.lang2
      : null;
  const t2 = lang2 ? STICKER_FORM_TEXT[lang2] : null;
  const e = (key: keyof FormText) => {
    const main = escapeHtml(t[key]);
    if (!t2 || !t2[key]) return main;
    return `${main} <bdi class="l2" lang="${lang2}" dir="auto">${escapeHtml(t2[key])}</bdi>`;
  };
  const size = lang2 ? BILINGUAL.size : style.size;
  const lh = lang2 ? BILINGUAL.lh : style.lh;
  const l2Font = lang2 ? LANG_STYLE[lang2].font : '';
  const bx = (key: keyof FormText) =>
    `<span><span class="bx"></span>${e(key)}</span>`;
  const line = (text: string, size: number, bold = false) =>
    `<div dir="auto" class="hl" style="font-size:${size}px;${bold ? 'font-weight:700;' : ''}">${escapeHtml(text)}</div>`;

  const header = [
    line(
      snapshot.shopName,
      fitFontSize(snapshot.shopName.length, 11, 40),
      true,
    ),
    snapshot.address
      ? line(snapshot.address, fitFontSize(snapshot.address.length, 10.5, 55))
      : '',
    snapshot.line3
      ? line(snapshot.line3, fitFontSize(snapshot.line3.length, 10.5, 40))
      : '',
  ].join('');

  return `<div class="label${lang2 ? ' bi' : ''}" lang="${lang}" dir="${style.dir}" style="font-family:${style.font},${HEAD_FONT};font-size:${size}px;line-height:${lh}${lang2 ? `;--l2-font:${l2Font}` : ''}">
<div class="head">${header}</div>
<div class="row"><span>${e('patient')}</span><span class="dot" style="flex-grow:3"></span><span>${e('date')}</span><span class="dot" style="flex-grow:2"></span></div>
<div class="row"><span>${e('drug')}</span><span class="dot" style="flex-grow:3"></span><span>${e('indication')}</span><span class="dot" style="flex-grow:2"></span></div>
<div class="row"><span>${e('take')}</span><span class="dot" style="flex:0 0 24px"></span>${bx('tab')}${bx('ml')}${bx('tsp')}${bx('tbsp')}</div>
<div class="row sb">${bx('before')}${bx('after')}<span class="il">${e('perDay')}<span class="dot" style="flex:0 0 22px;display:inline-block"></span>${e('times')}</span></div>
<div class="row sb">${bx('morning')}${bx('noon')}${bx('evening')}${bx('bedtime')}</div>
<div class="row sb"><span class="il">${bx('every')}<span class="dot" style="flex:0 0 16px;display:inline-block"></span>${e('hrs')}</span>${bx('rightAfter')}</div>
<div class="row sb">${bx('drowsy')}${bx('finish')}</div>
</div>`;
}

export interface StickerPdfJob {
  snapshot: StickerOrderSnapshot;
  /** จำนวนหน้า (แผ่น) ของงานนี้ */
  pages: number;
}

/** HTML ทั้งเอกสาร — ทุกหน้าของงานเดียวกันเหมือนกัน หน้าละ 10 ดวง */
export function buildStickerSheetHtml(
  jobs: StickerPdfJob[],
  options: { googleFonts?: boolean; offset?: string; gap?: string } = {},
): string {
  const gap = sheetGap(options.gap);
  const origin = sheetOrigin(options.offset, gap);
  const pages: string[] = [];
  for (const job of jobs) {
    const ink = inkOf(job.snapshot);
    const label = labelHtml(job.snapshot);
    const sheet = `<section class="sheet" style="color:${ink}"><div class="grid">${label.repeat(SHEET.cols * SHEET.rows)}</div></section>`;
    for (let i = 0; i < job.pages; i++) pages.push(sheet);
  }

  const fontsHref =
    options.googleFonts === false
      ? null
      : googleFontsCss(
          jobs.flatMap((j) => [
            j.snapshot.lang,
            ...(j.snapshot.lang2 ? [j.snapshot.lang2] : []),
          ]),
        );

  return `<!doctype html>
<html><head><meta charset="utf-8">
${fontsHref ? `<link rel="stylesheet" href="${fontsHref}">` : ''}
<style>
${sarabunFontFace()}
@page{size:A4;margin:0}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{position:relative;width:${SHEET.pageW}mm;height:${SHEET.pageH}mm;overflow:hidden;page-break-after:always;break-after:page}
.sheet:last-child{page-break-after:auto;break-after:auto}
.grid{position:absolute;left:${origin.left}mm;top:${origin.top}mm;display:grid;grid-template-columns:repeat(${SHEET.cols},${SHEET.labelW}mm);grid-template-rows:repeat(${SHEET.rows},${SHEET.labelH}mm);column-gap:${gap.x}mm;row-gap:${gap.y}mm}
.label{min-width:0;overflow:hidden;border:1.2px solid currentColor;padding:5px 7px;display:flex;flex-direction:column;justify-content:space-between;color:inherit}
.head{border:1.2px solid currentColor;border-radius:2px;padding:2px 6px;text-align:center;display:flex;flex-direction:column}
.hl{font-family:${HEAD_FONT};line-height:1.25;white-space:nowrap;overflow:hidden}
.row{display:flex;flex-wrap:nowrap;align-items:baseline;column-gap:6px;white-space:nowrap}
.row>span{white-space:nowrap}
.sb{justify-content:space-between}
.il{display:inline-flex;align-items:baseline;gap:4px}
.dot{flex:1 1 auto;border-bottom:1px dotted currentColor;height:1px;margin-bottom:2px;min-width:16px}
.bx{display:inline-block;width:7px;height:7px;border:1px solid currentColor;margin-inline-end:3px;vertical-align:0}
.l2{font-family:var(--l2-font),sans-serif;font-size:0.88em;opacity:.9}
.bi .row{column-gap:4px;row-gap:0;flex-wrap:wrap}
.bi .dot{min-width:10px}
</style></head>
<body>${pages.join('')}</body></html>`;
}
