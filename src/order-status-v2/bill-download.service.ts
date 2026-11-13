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

interface IssuedBillRef {
  shRunning: string;
  invoiceNo: string;
}

// ECWC-767: ดาวน์โหลดบิล PDF จาก bill-management-service (บิลทั้ง ecommerce และ legacy ที่ผ่าน QC แล้ว)
@Injectable()
export class BillDownloadService {
  private readonly logger = new Logger(BillDownloadService.name);
  private readonly billApiUrl: string;
  private readonly billApiKey: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.billApiUrl = (
      this.configService.get<string>('BILL_API_URL') ??
      'https://warehouse.wangpharma.com/api/billing'
    ).replace(/\/$/, '');
    this.billApiKey = this.configService.get<string>('BILL_API_KEY') ?? '';
  }

  // sh_running → เลขบิล เฉพาะใบที่ออกบิลแล้ว · เรียกระบบบิลไม่ได้ = ถือว่ายังไม่มีบิล ไม่ให้หน้าสถานะพังตาม
  async findIssuedInvoices(
    memCode: string,
    shRunnings: string[],
  ): Promise<Map<string, string>> {
    if (shRunnings.length === 0 || !this.billApiKey) return new Map();
    try {
      const response = await firstValueFrom(
        this.httpService.post<IssuedBillRef[]>(
          `${this.billApiUrl}/bills/issued-lookup`,
          { memCode, shRunnings },
          { headers: { 'x-api-key': this.billApiKey }, timeout: 5000 },
        ),
      );
      return new Map(
        response.data.map((ref) => [ref.shRunning, ref.invoiceNo]),
      );
    } catch (error: unknown) {
      this.logger.error(
        `Error lookup issued bills ${memCode}: ${error instanceof Error ? error.message : String(error)}`,
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
