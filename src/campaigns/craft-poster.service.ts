import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface PosterImageItem {
  url: string;
  name: string;
  quantity: number;
  unit: string;
  type?: 'gift' | 'purchase' | 'reference';
}

/** What the render service's POST /poster expects (company-day-poster/poster.py). */
export interface CraftPosterRequest {
  promotion_name: string;
  date_range?: string;
  min_purchase?: number;
  theme?: string;
  aspect_ratio: string;
  purchases: { url: string; name: string }[];
  gifts: { url?: string; name: string; quantity?: number; unit?: string }[];
}

// The exact theme sentences Company Day's poster page writes into its prompt
// (promo-sheet-pro, PosterConfigPage.tsx buildPrompt themeMap).
const THEME_PHRASES: Record<string, string> = {
  warm: 'โทนสีแดง-ส้ม-เหลือง gradient อบอุ่น โดดเด่น ดึงดูดสายตา',
  cool: 'โทนสีน้ำเงิน-ฟ้า-ฟ้าอ่อน gradient เรียบสะอาด น่าเชื่อถือ',
  green: 'โทนสีเขียว-มรกต gradient สุขภาพ ธรรมชาติ',
  purple: 'โทนสีม่วง-ไวโอเล็ต gradient พรีเมียม หรูหรา',
  monochrome: 'โทนขาว-เทา-ดำ minimal เรียบ corporate',
  vibrant: 'โทนหลายสีสดใส สนุก ดึงดูดสายตา',
};

const REQUEST_PREFIX = 'craft-';

/**
 * Draws Company Day posters with the template render service instead of Ideogram.
 *
 * Switched on with POSTER_ENGINE=craft; CRAFT_RENDER_URL is where this backend reaches the
 * service and CRAFT_RENDER_PUBLIC_URL (default: the same) is the address browsers use for the
 * finished image. It keeps Ideogram's request/poll contract, so the poster page is unchanged:
 * generate returns a request_id at once (the poster is already drawn) and polling it returns
 * the image URL.
 */
@Injectable()
export class CraftPosterService {
  private readonly logger = new Logger(CraftPosterService.name);

  static isEnabled(): boolean {
    return process.env.POSTER_ENGINE === 'craft';
  }

  private static serviceUrl(): string {
    return (process.env.CRAFT_RENDER_URL ?? '').replace(/\/+$/, '');
  }

  private static publicUrl(): string {
    return (
      process.env.CRAFT_RENDER_PUBLIC_URL || CraftPosterService.serviceUrl()
    ).replace(/\/+$/, '');
  }

  static isCraftRequest(requestId: string): boolean {
    return requestId.startsWith(REQUEST_PREFIX);
  }

  /** True for a finished poster's URL, which the image proxy may then fetch. */
  static isCraftPosterUrl(url: string): boolean {
    const base = CraftPosterService.publicUrl();
    return (
      !!base &&
      url.startsWith(`${base}/poster/`) &&
      /^[a-f0-9]{32}\.png$/.test(url.slice(base.length + 8))
    );
  }

  /**
   * The poster page sends its form only inside the Ideogram prompt, so read the fields back
   * out of the sentences buildPrompt writes. Anything not found is left out.
   */
  static parsePrompt(prompt: string): {
    promotionName?: string;
    dateRange?: string;
    minPurchase?: number;
    theme?: string;
    giftLines: string[];
  } {
    const name = /ข้อความหลัก \(แสดงขนาดใหญ่สุดด้านบน\): "(.+) PROMOTION"/.exec(
      prompt,
    )?.[1];
    const dateRange = /ระยะเวลาโปรโมชั่น: (.+)/.exec(prompt)?.[1]?.trim();
    const amount = /ครบ ([\d,.]+) บาท/.exec(prompt)?.[1];
    const theme = Object.keys(THEME_PHRASES).find((key) =>
      prompt.includes(`ใช้${THEME_PHRASES[key]}`),
    );
    const giftText = /รายการของแถม: (.+)/.exec(prompt)?.[1] ?? '';
    const giftLines = giftText
      .split(/, (?=\d+\. )/)
      .map((line) => line.replace(/^\d+\. /, '').trim())
      .filter(Boolean);
    const minPurchase = amount ? Number(amount.replace(/,/g, '')) : undefined;
    return {
      promotionName: name?.trim(),
      dateRange: dateRange || undefined,
      minPurchase:
        Number.isFinite(minPurchase) && minPurchase! > 0
          ? minPurchase
          : undefined,
      theme,
      giftLines,
    };
  }

  /** Builds the render request from what the poster page sends to /campaigns/generate-poster. */
  static toRequest(
    prompt: string,
    aspectRatio: string,
    imageItems: PosterImageItem[],
  ): CraftPosterRequest {
    const parsed = CraftPosterService.parsePrompt(prompt);
    const purchases = imageItems
      .filter((item) => item.type === 'purchase')
      .map((item) => ({ url: item.url, name: item.name }));
    const gifts: CraftPosterRequest['gifts'] = imageItems
      .filter((item) => !item.type || item.type === 'gift')
      .map((item) => ({
        url: item.url,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
      }));
    // Gifts without a picture are not in imageItems; they are only in the prompt's gift list.
    for (const line of parsed.giftLines) {
      const pictured = gifts.some(
        (gift) => line === `${gift.name} ${gift.quantity} ${gift.unit}`.trim(),
      );
      if (!pictured) gifts.push({ name: line });
    }
    // Style reference pictures (type 'reference') steer Ideogram's look; a template has no use for them.
    return {
      promotion_name: parsed.promotionName ?? 'โปรโมชั่น',
      date_range: parsed.dateRange,
      min_purchase: parsed.minPurchase,
      theme: parsed.theme,
      aspect_ratio: aspectRatio,
      purchases,
      gifts,
    };
  }

  /** Same reply shape as Ideogram's generate call; the poster is already drawn when it returns. */
  async generatePosterRequest(
    prompt: string,
    aspectRatio: string,
    imageItems: PosterImageItem[],
  ): Promise<{ request_id: string; user_id: string; caption: string }> {
    const base = CraftPosterService.serviceUrl();
    if (!base) throw new Error('CRAFT_RENDER_URL is not set');
    const body = CraftPosterService.toRequest(prompt, aspectRatio, imageItems);
    const response = await axios.post<{ id: string }>(
      `${base}/poster?store=1`,
      body,
      { timeout: 60_000 },
    );
    this.logger.log(
      `poster ${response.data.id} drawn for "${body.promotion_name}" (${aspectRatio})`,
    );
    return {
      request_id: `${REQUEST_PREFIX}${response.data.id}`,
      user_id: 'craft',
      caption: body.promotion_name,
    };
  }

  /** What the poster page polls for: { url } of the finished poster. */
  getResult(
    requestId: string,
  ): { url: string } | { message: string; requestId: string } {
    const id = requestId.slice(REQUEST_PREFIX.length);
    if (!/^[a-f0-9]{32}$/.test(id))
      return { message: 'response_id not found', requestId };
    return { url: `${CraftPosterService.publicUrl()}/poster/${id}.png` };
  }
}
