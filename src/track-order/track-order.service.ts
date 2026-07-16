import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface LogisticCheckpoint {
  type: 'DEPARTURE' | 'STORE_DELIVERED';
  latitude: string;
  longitude: string;
  time: string | null;
}

export interface LogisticTrackingInfo {
  status: 'DELIVERING' | 'DONE' | 'BACK';
  store_name: string;
  driver_name: string;
  finished_at: string | null;
  checkpoint: LogisticCheckpoint | null;
  stores_delivered: number;
  stores_total: number;
  store_latitude: string | null;
  store_longitude: string | null;
}

export interface TrackOrderResult {
  sh_running: string;
  latitude: string | null;
  longtitude: string | null;
  status: string;
  found_location: boolean;
  timestamp: string | Date;
  tracking: LogisticTrackingInfo | null;
}

const STATUS_TH: Record<LogisticTrackingInfo['status'], string> = {
  DELIVERING: 'กำลังนำส่ง',
  DONE: 'นำส่งแล้ว',
  BACK: 'ตีกลับ',
};

@Injectable()
export class TrackOrderService {
  private logisticUrl: string;
  private readonly logger = new Logger(TrackOrderService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.logisticUrl =
      this.configService.get<string>('LOGISTIC_API_URL') ??
      'https://warehouse.wangpharma.com';
  }

  async getOrderLocation(
    sh_running: string,
    mem_code: string,
  ): Promise<TrackOrderResult> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<LogisticTrackingInfo>(
          `${this.logisticUrl}/api/logistic/tracking/by-bill/${encodeURIComponent(sh_running)}`,
          { params: { mem_code } },
        ),
      );

      const tracking = response.data;
      const checkpoint = tracking.checkpoint;

      // field เดิม (latitude/longtitude/found_location) คงไว้ให้ app เวอร์ชันเก่าใช้ต่อได้
      return {
        sh_running,
        latitude: checkpoint?.latitude ?? null,
        longtitude: checkpoint?.longitude ?? null,
        status: STATUS_TH[tracking.status] ?? tracking.status,
        found_location: tracking.status === 'DELIVERING' && checkpoint !== null,
        timestamp: checkpoint?.time ?? new Date(),
        tracking,
      };
    } catch (error: unknown) {
      // 404 = บิลยังไม่อยู่ในรอบออกรถ / ยังไม่สร้าง token → ยังไม่เริ่มจัดส่ง
      if (error instanceof AxiosError && error.response?.status === 404) {
        return {
          sh_running,
          latitude: null,
          longtitude: null,
          status: 'กำลังเตรียมจัดส่ง',
          found_location: false,
          timestamp: new Date(),
          tracking: null,
        };
      }

      this.logger.error('Error Fetch Location Order', {
        event: 'location_order_error',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Error fetching order location data');
    }
  }
}
