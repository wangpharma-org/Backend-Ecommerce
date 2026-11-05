import { BadRequestException } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * ECWC-697 สติ๊กเกอร์ฉลากยาแบบพิมพ์หัวร้าน — กติกาที่ backend ถือเป็น source of truth
 * (รหัสสินค้าตาม print mode, ขนาดบรรจุ, ความยาวข้อความ) ห้ามเชื่อค่าจาก client
 */

export const STICKER_FEATURE_FLAG = 'sticker_label';

export type StickerPrintMode = 'bw' | 'color';
export type StickerLang = 'th' | 'en' | 'zh' | 'ru' | 'ar' | 'my';

/**
 * ฟอนต์ของฉลาก (ทั้งดวง) — Google Fonts ไลเซนส์ OFL ฝังในไฟล์พิมพ์ (src/sticker-label/fonts)
 * มีเฉพาะอักษรไทย/ละติน · จีน/อาหรับ/พม่า/รัสเซีย fallback ไปฟอนต์ Noto ของภาษานั้น
 * ไม่ระบุ = sarabun (ข้อมูลเดิมก่อนมีฟิลด์นี้)
 */
export const STICKER_FONTS = [
  'sarabun',
  'prompt',
  'kanit',
  'mitr',
  'trirong',
  'charm',
] as const;
export type StickerFont = (typeof STICKER_FONTS)[number];
export const DEFAULT_STICKER_FONT: StickerFont = 'sarabun';
export type StickerPackSize = '1' | '50';

/** print mode กำหนดรหัสสินค้า — client ส่งได้แค่ mode */
export const STICKER_PRO_CODE: Record<StickerPrintMode, string> = {
  bw: '95030411-05',
  color: '95030411-07',
};

export const STICKER_PRO_CODES = Object.values(STICKER_PRO_CODE);

export const STICKER_LANGS: StickerLang[] = [
  'th',
  'en',
  'zh',
  'ru',
  'ar',
  'my',
];

/** 1 แผ่น = 10 ดวง */
export const DOTS_PER_SHEET = 10;

export const STICKER_PACKS: Record<
  StickerPackSize,
  { sheets: number; dots: number; label: string }
> = {
  '1': { sheets: 1, dots: 10, label: '1 แผ่น = 10 ดวง' },
  '50': { sheets: 50, dots: 500, label: '50 แผ่น = 500 ดวง' },
};

export const STICKER_MAX_LENGTH = {
  shopName: 40,
  address: 55,
  line3: 40,
} as const;

export interface StickerCustomOptions {
  shopName: string;
  address: string;
  line3: string;
  lang: StickerLang;
  /**
   * ภาษาที่ 2 วางคู่ในบรรทัดเดียวกัน (ฉลาก 2 ภาษา) — มีได้เฉพาะเมื่อ lang = th และต้องไม่ใช่ th
   * ไม่มี = ฉลากภาษาเดียว (ข้อมูลเดิมก่อนมีฟิลด์นี้ก็เป็นแบบนี้)
   */
  lang2?: StickerLang;
  /** ไม่ระบุ = sarabun */
  font?: StickerFont;
  printMode: StickerPrintMode;
  /** hex #RRGGBB เฉพาะ mode color · bw เป็น null เสมอ */
  color: string | null;
  packSize: StickerPackSize;
}

/** snapshot ที่ติดกับ order line — เพิ่มจำนวนแผ่น/ดวงที่คำนวณตอนสร้างออเดอร์ */
export interface StickerOrderSnapshot extends StickerCustomOptions {
  sheets: number;
  dots: number;
}

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function isStickerProCode(pro_code: string | null | undefined): boolean {
  return !!pro_code && STICKER_PRO_CODES.includes(pro_code);
}

/** ภาษาที่เปิดขาย — คำแปลต้องผ่านเภสัชกร/เจ้าของภาษาก่อน (ECWC-705) จึงเปิดผ่าน env ทีละภาษา */
export function enabledStickerLangs(
  raw: string | undefined = process.env.STICKER_LABEL_ENABLED_LANGS,
): StickerLang[] {
  if (!raw?.trim()) return ['th'];
  const wanted = raw.split(',').map((s) => s.trim());
  return STICKER_LANGS.filter((lang) => wanted.includes(lang));
}

function text(value: unknown, field: keyof typeof STICKER_MAX_LENGTH): string {
  if (value == null) return '';
  if (typeof value !== 'string') {
    throw new BadRequestException(`${field} ต้องเป็นข้อความ`);
  }
  // ยุบช่องว่าง/บรรทัดใหม่ให้เหลือช่องเดียว — หัวฉลากเป็นบรรทัดเดียวเสมอ
  const cleaned = value.replace(/\s+/g, ' ').trim();
  if (cleaned.length > STICKER_MAX_LENGTH[field]) {
    throw new BadRequestException(
      `${field} ยาวได้ไม่เกิน ${STICKER_MAX_LENGTH[field]} ตัวอักษร`,
    );
  }
  return cleaned;
}

/** validate + จัดรูปค่าจาก client ให้เป็นรูปเดียวกันเสมอ (ใช้ทั้งเก็บและ hash) */
export function normalizeStickerOptions(
  input: unknown,
  enabledLangs: StickerLang[] = enabledStickerLangs(),
): StickerCustomOptions {
  if (!input || typeof input !== 'object') {
    throw new BadRequestException('ต้องระบุรูปแบบสติ๊กเกอร์ (custom_options)');
  }
  const raw = input as Record<string, unknown>;

  const shopName = text(raw.shopName, 'shopName');
  if (!shopName) throw new BadRequestException('ต้องระบุชื่อร้าน');

  const printMode = raw.printMode;
  if (printMode !== 'bw' && printMode !== 'color') {
    throw new BadRequestException('printMode ต้องเป็น bw หรือ color');
  }

  const lang = raw.lang as StickerLang;
  if (!STICKER_LANGS.includes(lang)) {
    throw new BadRequestException(`lang ต้องเป็น ${STICKER_LANGS.join('|')}`);
  }
  if (!enabledLangs.includes(lang)) {
    throw new BadRequestException(`ภาษา ${lang} ยังไม่เปิดขาย`);
  }

  // ฉลาก 2 ภาษา: ไทย + อีก 1 ภาษา
  let lang2: StickerLang | undefined;
  if (raw.lang2 != null && raw.lang2 !== '') {
    lang2 = raw.lang2 as StickerLang;
    if (!STICKER_LANGS.includes(lang2)) {
      throw new BadRequestException(
        `lang2 ต้องเป็น ${STICKER_LANGS.join('|')}`,
      );
    }
    if (lang !== 'th' || lang2 === 'th') {
      throw new BadRequestException('ฉลาก 2 ภาษาต้องเป็นภาษาไทย + อีก 1 ภาษา');
    }
    if (!enabledLangs.includes(lang2)) {
      throw new BadRequestException(`ภาษา ${lang2} ยังไม่เปิดขาย`);
    }
  }

  let font: StickerFont | undefined;
  if (raw.font != null && raw.font !== '') {
    font = raw.font as StickerFont;
    if (!STICKER_FONTS.includes(font)) {
      throw new BadRequestException(`font ต้องเป็น ${STICKER_FONTS.join('|')}`);
    }
    // ค่าเริ่มต้นไม่เก็บ — รูปแบบเดิม (ไม่มี font) กับ sarabun เป็นแบบเดียวกัน
    if (font === DEFAULT_STICKER_FONT) font = undefined;
  }

  let color: string | null = null;
  if (printMode === 'color') {
    if (typeof raw.color !== 'string' || !HEX_COLOR.test(raw.color)) {
      throw new BadRequestException('mode สี ต้องระบุ color เป็น hex #RRGGBB');
    }
    color = raw.color.toUpperCase();
  }

  const packSize = (
    typeof raw.packSize === 'number' ? String(raw.packSize) : raw.packSize
  ) as StickerPackSize;
  if (typeof packSize !== 'string' || !Object.hasOwn(STICKER_PACKS, packSize)) {
    throw new BadRequestException(
      `packSize ต้องเป็น ${Object.keys(STICKER_PACKS).join('|')}`,
    );
  }

  return {
    shopName,
    address: text(raw.address, 'address'),
    line3: text(raw.line3, 'line3'),
    lang,
    ...(lang2 ? { lang2 } : {}),
    ...(font ? { font } : {}),
    printMode,
    color,
    packSize,
  };
}

/** key ของรูปแบบ — รูปแบบเดียวกันได้ hash เดียวกัน (ลำดับ key คงที่) */
export function hashStickerOptions(options: StickerCustomOptions): string {
  const canonical = JSON.stringify([
    options.shopName,
    options.address,
    options.line3,
    options.lang,
    options.printMode,
    options.color,
    options.packSize,
    // ต่อท้ายเฉพาะฉลาก 2 ภาษา — hash ของฉลากภาษาเดียวเท่าเดิม
    ...(options.lang2 ? [options.lang2] : []),
    // ฟอนต์ที่ไม่ใช่ค่าเริ่มต้น — hash ของรูปแบบเดิมเท่าเดิม
    ...(options.font && options.font !== DEFAULT_STICKER_FONT
      ? [`font:${options.font}`]
      : []),
  ]);
  return createHash('sha1').update(canonical).digest('hex');
}

/**
 * แปลง "จำนวนแพ็ค" เป็น unit + จำนวนของสินค้า
 * เลือกหน่วยใหญ่สุดที่หารจำนวนดวงของแพ็คลงตัว (เช่น 500 ดวง → ม500ดวง × 1, 10 ดวง → ดวง × 10)
 */
export function packToCartUnit(
  packSize: StickerPackSize,
  packs: number,
  units: { unit_name: string; ratio: number; level: number }[],
): { unit_name: string; level: number; amount: number } {
  const dots = STICKER_PACKS[packSize].dots;
  const fit = units
    .filter((u) => Number(u.ratio) > 0 && dots % Number(u.ratio) === 0)
    .sort((a, b) => Number(b.ratio) - Number(a.ratio))[0];
  if (!fit) {
    throw new BadRequestException(
      'หน่วยของสินค้าสติ๊กเกอร์ไม่รองรับขนาดบรรจุนี้',
    );
  }
  return {
    unit_name: fit.unit_name,
    level: fit.level,
    amount: (packs * dots) / Number(fit.ratio),
  };
}

/** จำนวนแผ่น/ดวงของบรรทัด จาก amount × ratio ของหน่วย (หน่วยเล็กสุด = ดวง) */
export function stickerQuantity(
  amount: number,
  ratio: number,
  packSize: StickerPackSize,
): { dots: number; sheets: number; packs: number } {
  const dots = Number(amount) * Number(ratio || 1);
  return {
    dots,
    sheets: dots / DOTS_PER_SHEET,
    packs: dots / STICKER_PACKS[packSize].dots,
  };
}

/** mysql2 คืน JSON column เป็น object แล้ว แต่ getRawMany บางเวอร์ชันได้ string */
export function parseStickerJson<T>(value: unknown): T | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return null;
    }
  }
  return value as T;
}
