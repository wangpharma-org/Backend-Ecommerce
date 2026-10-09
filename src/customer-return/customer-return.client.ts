import {
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError, Method } from 'axios';
import { firstValueFrom } from 'rxjs';

// ECWC-691: ข้อมูลคำขอคืนอยู่ที่ Order Picking (source of truth) — ฝั่งนี้เป็นแค่ proxy ที่ยืนยันตัวลูกค้าแล้ว
@Injectable()
export class CustomerReturnClient {
  private readonly logger = new Logger(CustomerReturnClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // ใช้ตัวแปรเดียวกับ order-status-v2 (ชี้ไป order-picking-service)
    this.baseUrl =
      this.configService.get<string>('ORDER_PICKING_API_URL') ??
      'https://warehouse.wangpharma.com';
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  private async request<T>(
    method: Method,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const key = this.configService.get<string>('RETURN_INTERNAL_API_KEY');
    if (!key) {
      this.logger.error('RETURN_INTERNAL_API_KEY is not configured');
      throw new ServiceUnavailableException('ระบบคืนสินค้ายังไม่พร้อมใช้งาน');
    }
    try {
      const res = await firstValueFrom(
        this.httpService.request<T>({
          method,
          url: `${this.baseUrl}/api/customer-return/internal/${path}`,
          data: body,
          headers: { 'x-internal-key': key },
          timeout: 15000,
        }),
      );
      return res.data;
    } catch (error: unknown) {
      // 4xx จาก Order Picking (บิลหมดสิทธิ์, จำนวนเกิน ฯลฯ) ส่งต่อให้ลูกค้าเห็นข้อความเดิม
      const axiosError = error as AxiosError<{ message?: string | string[] }>;
      const status = axiosError.response?.status;
      if (status && status >= 400 && status < 500 && status !== 401) {
        const message = axiosError.response?.data?.message;
        throw new HttpException(
          { statusCode: status, message: message ?? 'คำขอไม่ถูกต้อง' },
          status,
        );
      }
      this.logger.error(`order-picking ${method} ${path} failed`, error);
      throw new ServiceUnavailableException(
        'ไม่สามารถเชื่อมต่อระบบคลังได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      );
    }
  }
}
