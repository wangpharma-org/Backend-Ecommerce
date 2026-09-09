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
          `${this.baseUrl}/api/notifications/dispatch`,
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

  async sendMany(list: PreorderNotification[]): Promise<number> {
    let ok = 0;
    for (const n of list) {
      if (await this.send(n)) ok += 1;
    }
    return ok;
  }
}
