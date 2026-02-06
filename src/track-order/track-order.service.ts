import { Injectable, Logger } from '@nestjs/common';
import { TrackOrderEntity } from './track-order.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { Cron } from '@nestjs/schedule';

interface CheckStatusResponse {
  member: string | null;
  car_number: string | null;
  emp_code: string | null;
  status: 'กำลังส่ง' | 'นำส่งแล้ว';
}

export interface Daum {
  vehicle_id: number;
  registration: string;
  engine_type: string;
  chassis_number: string;
  event_ts: string;
  bearing: number;
  speed: number;
  ignition: boolean;
  idling: boolean;
  odometer: number;
  clock: number;
  altitude: number;
  rpm: number;
  road_speed: number;
  vext: string;
  temp1: any;
  temp2: any;
  temp3: any;
  temp4: any;
  last_identification_tag_id: any;
  io_panic: string;
  io_disarm: string;
  dynamic1: any;
  dynamic2: any;
  dynamic3: any;
  dynamic4: any;
  input_state: number;
  input_state2: number;
  input_state3: any;
  central_locking_status: any;
  tcu_percentage: number;
  driver: Driver;
  fuel: Fuel;
  electric: Electric;
  location: Location;
}

export interface Driver {
  driver_id: any;
  first_name: any;
  last_name: any;
  id_number: any;
  license_number: any;
  driver_id_tag: any;
  phone_number: any;
}

export interface Fuel {
  updated: string;
  level: number;
  precentage_left: number;
  total_consumed: any;
}

export interface Electric {
  battery_percentage_left: any;
  battery_ts: any;
}

export interface Location {
  updated: string;
  longitude: number;
  latitude: number;
  gps_fix_type: number;
  position_description: string;
  geofence_ids: string[];
}

@Injectable()
export class TrackOrderService {
  private oldUrl: string;
  private carTrackUrl: string;
  private authToken: string;
  private readonly logger = new Logger(TrackOrderService.name);
  constructor(
    @InjectRepository(TrackOrderEntity)
    private readonly trackOrderRepository: Repository<TrackOrderEntity>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.oldUrl =
      this.configService.get<string>('OLD_WEBSITE_URL') ??
      'http://www.wangpharma.com';
    this.authToken =
      this.configService.get<string>('CARTRACK_AUTH_TOKEN') ?? '';
    this.carTrackUrl = this.configService.get<string>('CARTRACK_URL') ?? '';
  }

  async getOrderLocation(sh_running: string) {
    try {
      const responseCheckOrder = await firstValueFrom(
        this.httpService.get(
          `${this.oldUrl}/Akitokung/api/car_logistic.php?bill=${encodeURIComponent(sh_running)}`,
        ),
      );

      const checkOrderStatus = responseCheckOrder.data as CheckStatusResponse;

      if (checkOrderStatus.status === 'นำส่งแล้ว') {
        await this.trackOrderRepository.delete({ sh_running });
        return {
          sh_running,
          latitude: null,
          longtitude: null,
          status: 'นำส่งแล้ว',
          found_location: false,
          timestamp: new Date(),
        };
      }

      const carRandomForTest = this.randomCarNumberForTest();

      if (!checkOrderStatus.car_number) {
        checkOrderStatus.car_number = carRandomForTest;
      }

      if (
        checkOrderStatus.emp_code &&
        checkOrderStatus.car_number &&
        checkOrderStatus.status === 'กำลังส่ง'
      ) {
        const reg = encodeURIComponent(checkOrderStatus.car_number.trim());

        const authHeader = this.authToken.startsWith('Basic ')
          ? this.authToken
          : `Basic ${this.authToken}`;

        const responseCarInfo = await firstValueFrom(
          this.httpService.get(
            `${this.carTrackUrl}/rest/vehicles/status?filter[registration]=${reg}`,
            {
              headers: {
                Accept: 'application/json',
                Authorization: authHeader,
              },
            },
          ),
        );

        const carInfo = responseCarInfo.data as { data: Daum[] };
        const first = carInfo.data?.[0];

        if (
          first?.location?.latitude == null ||
          first?.location?.longitude == null
        ) {
          const [dataInDB] = await this.trackOrderRepository.find({
            where: { sh_running },
            order: { updated_at: 'DESC' },
            take: 1,
          });

          if (dataInDB?.latitude != null && dataInDB?.longtitude != null) {
            return {
              sh_running,
              latitude: dataInDB.latitude,
              longtitude: dataInDB.longtitude,
              status: 'กำลังนำส่ง',
              found_location: true,
              timestamp: dataInDB.updated_at ?? new Date(),
            };
          }

          return {
            sh_running,
            latitude: null,
            longtitude: null,
            status: 'กำลังนำส่ง',
            found_location: false,
            timestamp: new Date(),
          };
        }

        const latitude = String(first.location.latitude);
        const longtitude = String(first.location.longitude);

        await this.trackOrderRepository.upsert(
          { sh_running, latitude, longtitude },
          ['sh_running'],
        );

        const latest = await this.trackOrderRepository.findOne({
          where: { sh_running },
        });

        return {
          sh_running,
          latitude,
          longtitude,
          status: 'กำลังนำส่ง',
          found_location: true,
          timestamp: latest?.updated_at ?? new Date(),
        };
      }

      return {
        sh_running,
        latitude: null,
        longtitude: null,
        status: 'กำลังเตรียมจัดส่ง',
        found_location: false,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Error Fetch Location Order', {
        event: 'location_order_error',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error('Error fetching order location data');
    }
  }

  randomCarNumberForTest() {
    const carNumber = [
      'นข7453',
      'ผธ4175',
      'ผพ1737',
      'ผพ-6550',
      'บม7241',
      'ผธ3723',
      'บฉ7831',
      '830026',
      'ผพ5302',
      'ผน8474',
    ];
    const randomIndex = Math.floor(Math.random() * carNumber.length);
    return carNumber[randomIndex];
  }

  @Cron('0 0 * * *')
  async clearDB() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    await this.trackOrderRepository
      .createQueryBuilder()
      .delete()
      .where('updated_at < :cutoffDate', { cutoffDate })
      .execute();
  }
}
