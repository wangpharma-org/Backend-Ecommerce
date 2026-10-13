import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { execFile } from 'child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  exportIsMultiPage,
  ghostscriptArgs,
  type StickerExportFormat,
} from './sticker-export';

const GS_TIMEOUT_MS = 180_000;

/** Ghostscript ต่าง path ตามเครื่อง — Docker ใช้ `gs` (apt ghostscript) */
const gsBin = () =>
  process.env.GHOSTSCRIPT_BIN ??
  (process.platform === 'win32' ? 'gswin64c' : 'gs');

/**
 * แปลง PDF (RGB จาก Chrome) → ไฟล์ CMYK ด้วย Ghostscript
 * คืนไฟล์เรียงตามหน้า (ai = 1 ไฟล์รวมทุกหน้า)
 */
@Injectable()
export class StickerExportService {
  private readonly logger = new Logger(StickerExportService.name);

  async convert(
    pdf: Buffer,
    opts: {
      format: StickerExportFormat;
      blackOnly: boolean;
      outlineText: boolean;
    },
  ): Promise<Buffer[]> {
    const dir = await mkdtemp(join(tmpdir(), 'sticker-export-'));
    try {
      const input = join(dir, 'in.pdf');
      await writeFile(input, pdf);
      const output = join(
        dir,
        exportIsMultiPage(opts.format)
          ? `out.${opts.format}`
          : `out-%03d.${opts.format}`,
      );
      await this.run(ghostscriptArgs({ ...opts, input, output }));
      const names = (await readdir(dir))
        .filter((n) => n.startsWith('out'))
        .sort();
      if (names.length === 0) {
        throw new InternalServerErrorException(
          'แปลงไฟล์ไม่สำเร็จ (ไม่มีไฟล์ผลลัพธ์)',
        );
      }
      return Promise.all(names.map((n) => readFile(join(dir, n))));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  private run(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      execFile(
        gsBin(),
        args,
        {
          timeout: GS_TIMEOUT_MS,
          maxBuffer: 4 * 1024 * 1024,
          windowsHide: true,
        },
        (error, _stdout, stderr) => {
          if (!error) return resolve();
          if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return reject(
              new ServiceUnavailableException(
                'เซิร์ฟเวอร์ยังไม่ได้ติดตั้ง Ghostscript (ตั้ง GHOSTSCRIPT_BIN หรือ apt install ghostscript)',
              ),
            );
          }
          this.logger.error(`ghostscript failed: ${error.message} ${stderr}`);
          reject(new InternalServerErrorException('แปลงไฟล์ไม่สำเร็จ'));
        },
      );
    });
  }
}
