import { crc32, deflateRawSync } from 'zlib';

/**
 * ECWC-697 ส่งออกไฟล์ CMYK ให้ทีมกราฟิกแก้ต่อ — แปลงจาก PDF ของระบบด้วย Ghostscript
 * - ai  : PDF CMYK (Illustrator เปิดแก้ได้) ไฟล์เดียวทุกหน้า
 * - eps : เวกเตอร์ CMYK 1 ไฟล์ต่อหน้า
 * - jpg : ภาพ CMYK 300dpi 1 ไฟล์ต่อหน้า
 * - psd : ภาพ CMYK 300dpi เลเยอร์เดียว 1 ไฟล์ต่อหน้า
 */
export const STICKER_EXPORT_FORMATS = ['ai', 'eps', 'jpg', 'psd'] as const;
export type StickerExportFormat = (typeof STICKER_EXPORT_FORMATS)[number];

export const isStickerExportFormat = (v: unknown): v is StickerExportFormat =>
  typeof v === 'string' &&
  (STICKER_EXPORT_FORMATS as readonly string[]).includes(v);

/** งานสูงสุดต่อครั้ง (1 งาน = 1 หน้า A4) — psd ไม่บีบอัด หน้าละ ~35MB */
export const STICKER_EXPORT_MAX_JOBS: Record<StickerExportFormat, number> = {
  ai: 200,
  eps: 50,
  jpg: 50,
  psd: 10,
};

export const STICKER_EXPORT_DPI = 300;

/** ไฟล์เดียวทุกหน้า หรือ 1 ไฟล์ต่อหน้า (รวมเป็น zip เมื่อมีหลายหน้า) */
export const exportIsMultiPage = (format: StickerExportFormat) =>
  format === 'ai';

export interface StickerExportArgsInput {
  format: StickerExportFormat;
  input: string;
  /** ไฟล์ปลายทาง — หลายหน้าใช้ %03d */
  output: string;
  /** งานขาวดำ: ตัวอักษร/เส้นเป็นดำล้วน K100 ไม่ใช่ดำผสม 4 สี */
  blackOnly: boolean;
  /** แปลงตัวอักษรเป็นเส้น — เปิดได้ทุกเครื่องโดยไม่ต้องมีฟอนต์ (ai/eps) */
  outlineText: boolean;
}

/** argument ของ Ghostscript — ไม่ผ่าน shell, ไฟล์ input เป็น PDF ที่ระบบสร้างเอง */
export function ghostscriptArgs(o: StickerExportArgsInput): string[] {
  const args = ['-dSAFER', '-dBATCH', '-dNOPAUSE', '-dQUIET'];
  if (o.blackOnly) args.push('-dBlackText', '-dBlackVector');
  switch (o.format) {
    case 'ai':
    case 'eps':
      args.push(
        o.format === 'ai' ? '-sDEVICE=pdfwrite' : '-sDEVICE=eps2write',
        '-sColorConversionStrategy=CMYK',
        '-sProcessColorModel=DeviceCMYK',
      );
      if (o.format === 'ai') args.push('-dCompatibilityLevel=1.6');
      if (o.outlineText) args.push('-dNoOutputFonts');
      break;
    case 'jpg':
      args.push(
        '-sDEVICE=jpegcmyk',
        '-dJPEGQ=95',
        `-r${STICKER_EXPORT_DPI}`,
        '-dTextAlphaBits=4',
        '-dGraphicsAlphaBits=4',
      );
      break;
    case 'psd':
      args.push(
        '-sDEVICE=psdcmyk',
        `-r${STICKER_EXPORT_DPI}`,
        '-dTextAlphaBits=4',
        '-dGraphicsAlphaBits=4',
      );
      break;
  }
  args.push(`-sOutputFile=${o.output}`, o.input);
  return args;
}

export const EXPORT_CONTENT_TYPE: Record<StickerExportFormat, string> = {
  ai: 'application/postscript',
  eps: 'application/postscript',
  jpg: 'image/jpeg',
  psd: 'image/vnd.adobe.photoshop',
};

/** zip แบบเรียบง่าย (deflate) — ไม่ต้องพึ่ง dependency เพิ่ม */
export function buildZip(files: { name: string; data: Buffer }[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8');
    const deflated = deflateRawSync(f.data);
    // บีบแล้วไม่เล็กลง (jpg) เก็บแบบไม่บีบ
    const stored = deflated.length >= f.data.length;
    const body = stored ? f.data : deflated;
    const method = stored ? 0 : 8;
    const crc = crc32(f.data) >>> 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // ชื่อไฟล์ UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(f.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, body);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(f.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);

    offset += local.length + name.length + body.length;
  }
  const centralSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}
