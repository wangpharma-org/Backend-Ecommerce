import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

export interface RedeemStockOutItem {
  pro_code: string;
  pro_name: string;
}

export interface RedeemStockOutPayload {
  file_name: string;
  items: RedeemStockOutItem[];
}

@Injectable()
export class LineSupportService {
  private readonly logger = new Logger(LineSupportService.name);
  private readonly baseUrl =
    process.env.LINE_SUPPORT_URL ||
    'https://line-support.wangpharma.com/api/line-support';
  private readonly apiKey = process.env.LINE_SUPPORT_API_KEY || '';
  private readonly timeoutMs = Number(
    process.env.LINE_SUPPORT_TIMEOUT ?? 10000,
  );

  /**
   * แจ้งเตือนสินค้าแลกแต้มที่ stock = 0 หลังอัปเดต stock จาก back office (ECWC-477)
   * ส่ง 1 ข้อความต่อ 1 ไฟล์ที่อัปโหลด — ห้าม throw ออกไปทำให้ update stock พัง
   */
  async notifyRedeemStockOut(payload: RedeemStockOutPayload): Promise<boolean> {
    if (payload.items.length === 0) {
      return false;
    }

    if (!this.apiKey) {
      this.logger.error(
        'LINE_SUPPORT_API_KEY is not set, skip redeem stock-out notification',
      );
      return false;
    }

    try {
      await axios.post(
        `${this.baseUrl}/notifications/redeem-stock-out`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'x-api-key': this.apiKey,
          },
          timeout: this.timeoutMs,
        },
      );
      this.logger.log(
        `Sent redeem stock-out notification: file=${payload.file_name} items=${payload.items.length}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send redeem stock-out notification (file=${payload.file_name}, items=${payload.items.length})`,
        error instanceof Error ? error.stack : String(error),
      );
      return false;
    }
  }
}
