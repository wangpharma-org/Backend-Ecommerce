import { inflateRawSync } from 'zlib';
import {
  STICKER_EXPORT_MAX_JOBS,
  buildZip,
  exportIsMultiPage,
  ghostscriptArgs,
  isStickerExportFormat,
} from './sticker-export';

const base = {
  input: 'in.pdf',
  output: 'out-%03d.x',
  blackOnly: false,
  outlineText: false,
};

describe('sticker-export', () => {
  it('รับเฉพาะ ai/eps/jpg/psd', () => {
    expect(['ai', 'eps', 'jpg', 'psd'].every(isStickerExportFormat)).toBe(true);
    expect(isStickerExportFormat('pdf')).toBe(false);
    expect(isStickerExportFormat(undefined)).toBe(false);
  });

  it('ai = pdfwrite CMYK ไฟล์เดียว, ที่เหลือ 1 ไฟล์ต่อหน้า', () => {
    const a = ghostscriptArgs({ ...base, format: 'ai' });
    expect(a).toEqual(
      expect.arrayContaining([
        '-sDEVICE=pdfwrite',
        '-sColorConversionStrategy=CMYK',
      ]),
    );
    expect(exportIsMultiPage('ai')).toBe(true);
    expect(exportIsMultiPage('jpg')).toBe(false);
  });

  it('jpg/psd เป็นภาพ CMYK 300dpi', () => {
    expect(ghostscriptArgs({ ...base, format: 'jpg' })).toEqual(
      expect.arrayContaining(['-sDEVICE=jpegcmyk', '-r300']),
    );
    expect(ghostscriptArgs({ ...base, format: 'psd' })).toEqual(
      expect.arrayContaining(['-sDEVICE=psdcmyk', '-r300']),
    );
  });

  it('ขาวดำ → ดำล้วน, outline เฉพาะเวกเตอร์', () => {
    expect(
      ghostscriptArgs({
        ...base,
        format: 'eps',
        blackOnly: true,
        outlineText: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        '-dBlackText',
        '-dBlackVector',
        '-dNoOutputFonts',
        '-sDEVICE=eps2write',
      ]),
    );
    const jpg = ghostscriptArgs({ ...base, format: 'jpg', outlineText: true });
    expect(jpg).not.toContain('-dNoOutputFonts');
    expect(jpg).not.toContain('-dBlackText');
  });

  it('SAFER และ input/output อยู่ท้ายสุด', () => {
    const a = ghostscriptArgs({ ...base, format: 'psd' });
    expect(a[0]).toBe('-dSAFER');
    expect(a.slice(-2)).toEqual(['-sOutputFile=out-%03d.x', 'in.pdf']);
  });

  it('psd จำกัดจำนวนงานน้อยสุด', () => {
    expect(STICKER_EXPORT_MAX_JOBS.psd).toBeLessThan(
      STICKER_EXPORT_MAX_JOBS.jpg,
    );
  });

  it('zip อ่านกลับได้ ชื่อไทย + crc ถูก', () => {
    const files = [
      { name: 'ก-1.txt', data: Buffer.from('สวัสดี'.repeat(50)) },
      { name: 'b.bin', data: Buffer.from([1, 2, 3]) },
    ];
    const zip = buildZip(files);
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 22 + 10)).toBe(2);
    let off = 0;
    for (const f of files) {
      const method = zip.readUInt16LE(off + 8);
      const size = zip.readUInt32LE(off + 18);
      const nameLen = zip.readUInt16LE(off + 26);
      const name = zip.subarray(off + 30, off + 30 + nameLen).toString('utf8');
      const body = zip.subarray(off + 30 + nameLen, off + 30 + nameLen + size);
      expect(name).toBe(f.name);
      expect(method === 8 ? inflateRawSync(body) : body).toEqual(f.data);
      off += 30 + nameLen + size;
    }
  });
});
