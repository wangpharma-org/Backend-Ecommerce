import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { isAxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

// ECWC-767: มีบิลหรือไม่ดูจาก order picking (QC ผ่านแล้ว) · PDF ให้ bill-management-service วาดจากข้อมูล order picking ตอนกด
@Injectable()
export class BillDownloadService {
  private readonly logger = new Logger(BillDownloadService.name);
  private readonly billApiUrl: string;
  private readonly billApiKey: string;
  private readonly orderPickingUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.billApiUrl = (
      this.configService.get<string>('BILL_API_URL') ??
      'https://warehouse.wangpharma.com/api/billing'
    ).replace(/\/$/, '');
    this.billApiKey = this.configService.get<string>('BILL_API_KEY') ?? '';
    this.orderPickingUrl = (
      this.configService.get<string>('ORDER_PICKING_API_URL') ??
      'https://warehouse.wangpharma.com'
    ).replace(/\/$/, '');
  }

  // sh_running → เลขบิล เฉพาะใบที่ QC ผ่านแล้ว · เรียก order picking ไม่ได้ = ถือว่ายังไม่มีบิล ไม่ให้หน้าสถานะพังตาม
  async findIssuedInvoices(
    memCode: string,
    shRunnings: string[],
  ): Promise<Map<string, string>> {
    if (shRunnings.length === 0) return new Map();
    try {
      const response = await firstValueFrom(
        this.httpService.post<Record<string, string>>(
          `${this.orderPickingUrl}/api/ecom/bill/ready-batch`,
          { mem_code: memCode, sh_running: shRunnings },
          { timeout: 5000 },
        ),
      );
      return new Map(Object.entries(response.data ?? {}));
    } catch (error: unknown) {
      this.logger.error(
        `Error lookup bill-ready runnings ${memCode}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return new Map();
    }
  }

  async downloadPdf(
    memCode: string,
    shRunning: string,
  ): Promise<{ fileName: string; data: Buffer }> {
    if (!this.billApiKey) {
      throw new ServiceUnavailableException(
        'ยังไม่ได้ตั้งค่าการเชื่อมต่อระบบบิล',
      );
    }
    try {
      const response = await firstValueFrom(
        this.httpService.get<ArrayBuffer>(
          `${this.billApiUrl}/bills/pdf/${encodeURIComponent(shRunning)}`,
          {
            params: { memCode },
            headers: { 'x-api-key': this.billApiKey },
            responseType: 'arraybuffer',
            timeout: 60000,
          },
        ),
      );
      return {
        fileName: this.fileNameFrom(
          response.headers['content-disposition'],
          shRunning,
        ),
        data: Buffer.from(response.data),
      };
    } catch (error: unknown) {
      if (isAxiosError(error) && error.response?.status === 404) {
        throw new NotFoundException('ยังไม่มีบิล');
      }
      this.logger.error(
        `Error download bill pdf ${shRunning}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new ServiceUnavailableException(
        'ดาวน์โหลดบิลไม่สำเร็จ กรุณาลองใหม่',
      );
    }
  }

  private fileNameFrom(disposition: unknown, shRunning: string): string {
    const match =
      typeof disposition === 'string'
        ? /filename="([^"]+)"/.exec(disposition)
        : null;
    return match?.[1] ?? `${shRunning}.pdf`;
  }
}
