import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

export interface PreorderNotification {
  memCode: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

/**
 * ส่งแจ้งเตือนผ่าน notification-service (FCM + LINE)
 * ล้มเหลวแล้วแค่ log ไม่ทำให้ flow หลักพัง
 */
@Injectable()
export class PreorderNotifierService {
  private readonly logger = new Logger(PreorderNotifierService.name);
  private readonly baseUrl =
    process.env.NOTIFICATION_SERVICE_URL ?? 'http://localhost:3005';

  constructor(private readonly http: HttpService) {}

  async send(n: PreorderNotification): Promise<boolean> {
    try {
      await lastValueFrom(
        this.http.post(
          `${this.baseUrl}/api/notifications/notifications/dispatch`,
          {
            memCode: n.memCode,
            type: 'preorder',
            title: n.title,
            message: n.message,
            channels: ['FCM', 'LINE'],
            data: n.data ?? {},
          },
          { timeout: 5000 },
        ),
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `preorder notify failed mem=${n.memCode}: ${String(err)}`,
      );
      return false;
    }
  }

  async sendMany(
    list: PreorderNotification[],
    concurrency = 1,
  ): Promise<number> {
    let ok = 0;
    for (let i = 0; i < list.length; i += concurrency) {
      const sent = await Promise.all(
        list.slice(i, i + concurrency).map((n) => this.send(n)),
      );
      ok += sent.filter(Boolean).length;
    }
    return ok;
  }

  /** ร้านที่ผูก LINE OA ไว้ (ข้อมูลอยู่ฝั่ง notification-service) — throw เมื่อเรียกไม่ได้ ให้ผู้เรียกตัดสินใจ retry */
  async getLineRegisteredMemCodes(): Promise<string[]> {
    const res = await lastValueFrom(
      this.http.get<{ memCodes?: string[] }>(
        `${this.baseUrl}/api/notifications/admin/users/line-registered`,
        { timeout: 10000 },
      ),
    );
    return Array.isArray(res.data?.memCodes) ? res.data.memCodes : [];
  }
}
