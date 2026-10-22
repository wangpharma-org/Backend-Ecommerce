import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';

const ALLOWED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

/**
 * ECWC-704 HTML → PDF ด้วย Chrome (จัดสระไทย/อาหรับ RTL/อักษรพม่าได้ถูกต้อง และฝังฟอนต์ที่ใช้ให้เอง)
 * เปิด browser ต่องานแล้วปิด — งานพิมพ์ไม่ถี่ ไม่คุ้มถือ browser ค้างไว้
 */
@Injectable()
export class StickerPdfRendererService {
  private readonly logger = new Logger(StickerPdfRendererService.name);

  async render(html: string): Promise<Buffer> {
    const isLinux = process.platform === 'linux';
    const executablePath =
      process.env.CHROME_EXECUTABLE_PATH ??
      process.env.PUPPETEER_EXECUTABLE_PATH ??
      (!isLinux
        ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
        : undefined);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: isLinux
        ? [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
          ]
        : [],
    });
    try {
      const page = await browser.newPage();
      // ข้อความลูกค้าถูก escape แล้ว แต่ยังบล็อก request ภายนอกทั้งหมดยกเว้นฟอนต์ไว้อีกชั้น
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const url = req.url();
        if (url.startsWith('data:')) return void req.continue();
        try {
          const { protocol, hostname } = new URL(url);
          if (protocol === 'https:' && ALLOWED_HOSTS.includes(hostname)) {
            return void req.continue();
          }
        } catch {
          // URL แปลกๆ ไม่ให้ผ่าน
        }
        void req.abort();
      });

      try {
        await page.setContent(html, {
          waitUntil: 'networkidle0',
          timeout: 20000,
        });
      } catch (error) {
        // โหลด Google Fonts ไม่ทัน/ไม่มีเน็ต — ยังพิมพ์ได้ด้วยฟอนต์ในเครื่อง
        this.logger.warn(
          `setContent ไม่ครบ ใช้ฟอนต์ fallback: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      await page.evaluate(() => document.fonts.ready.then(() => true));

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
      });
      return Buffer.from(pdf);
    } finally {
      await browser.close();
    }
  }
}
