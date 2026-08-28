import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ProductsService } from '../products/products.service';
import {
  ECOM_ORDER_TIMELINE_LABEL,
  EcomOrderListV2Res,
  EcomOrderStatusV2Evidence,
  EcomOrderStatusV2Item,
  EcomOrderStatusV2Res,
  EcomOrderTimelineStatus,
} from './types/order-status-v2.types';

interface OrderPickingStatusRes {
  sh_running: string;
  status: 'picking' | 'checking' | 'ready' | 'blocked';
  picked_time: string | null;
  qc_time: string | null;
  items: EcomOrderStatusV2Item[];
  price_before_qc: number | null;
  price_after_qc: number | null;
}

interface LogisticTrackingV2Res {
  status: 'DELIVERING' | 'DONE' | 'BACK';
  driver_name: string;
  driver_tel: string | null;
  finished_at: string | null;
  checkpoint: {
    type: 'DEPARTURE' | 'STORE_DELIVERED';
    latitude: string;
    longitude: string;
    time: string | null;
  } | null;
  evidence: EcomOrderStatusV2Evidence | null;
}

@Injectable()
export class OrderStatusV2Service {
  private readonly logger = new Logger(OrderStatusV2Service.name);
  private readonly orderPickingUrl: string;
  private readonly logisticUrl: string;

  constructor(
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>,
    private readonly productService: ProductsService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // สมมติฐาน: order-picking-service กับ logistics-backend อยู่หลัง gateway เดียวกัน
    // (LOGISTIC_API_URL เดิมของ track-order.service.ts ก็ defaultไปที่ host เดียวกันนี้)
    // ต้องยืนยัน/ตั้งค่า ORDER_PICKING_API_URL ให้ตรงจริงในแต่ละ environment ก่อน deploy
    this.orderPickingUrl =
      this.configService.get<string>('ORDER_PICKING_API_URL') ??
      'https://warehouse.wangpharma.com';
    this.logisticUrl =
      this.configService.get<string>('LOGISTIC_API_URL') ??
      'https://warehouse.wangpharma.com';
  }

  // ECWC-398/406: รายการ order พร้อม filter ช่วงวันที่ — endpoint ใหม่ ไม่แตะ AllOrderByMember เดิม
  async getOrderList(
    mem_code: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EcomOrderListV2Res> {
    try {
      const query = this.shoppingHeadRepo
        .createQueryBuilder('head')
        .leftJoin('head.details', 'order')
        .leftJoin('order.product', 'product')
        .where('head.mem_code = :mem_code', { mem_code });

      if (dateFrom) {
        query.andWhere('head.soh_datetime >= :dateFrom', { dateFrom });
      }
      if (dateTo) {
        query.andWhere('head.soh_datetime <= :dateTo', { dateTo });
      }

      const result = await query
        .select([
          'head.soh_running',
          'head.soh_sumprice',
          'head.soh_datetime',
          'head.soh_coin_recieve',
          'product.pro_code',
          'product.pro_imgmain',
          'order.spo_id',
          'order.spo_qty',
          'order.spo_unit',
        ])
        .orderBy('head.soh_datetime', 'DESC')
        .getMany();

      return await Promise.all(
        result.map(async (item) => {
          const groupedDetails: Record<
            string,
            {
              pro_code: string;
              product: { pro_code: string; pro_imgmain: string };
              items: { spo_id: number; spo_qty: number; spo_unit: string }[];
            }
          > = {};

          for (const detail of item.details) {
            const proCode = detail.product.pro_code;
            if (!groupedDetails[proCode]) {
              groupedDetails[proCode] = {
                pro_code: proCode,
                product: detail.product,
                items: [],
              };
            }
            groupedDetails[proCode].items.push({
              spo_id: detail.spo_id,
              spo_qty: detail.spo_qty,
              spo_unit: detail.spo_unit,
            });
          }

          const totalSmallestUnit = await Promise.all(
            Object.values(groupedDetails).map((group) => {
              const orderItems = group.items.map((line) => ({
                unit: line.spo_unit,
                quantity: parseFloat(String(line.spo_qty)),
                pro_code: group.pro_code,
              }));
              return this.productService.calculateSmallestUnit(orderItems);
            }),
          );

          return {
            soh_running: item.soh_running,
            soh_datetime: item.soh_datetime,
            soh_sumprice: item.soh_sumprice,
            soh_coin_recieve: item.soh_coin_recieve,
            details: item.details.length,
            totalSmallestUnit: Object.values(groupedDetails).map(
              (group, index) => ({
                pro_code: group.pro_code,
                totalSmallestUnit: totalSmallestUnit[index],
              }),
            ),
            Newdetails: Object.values(groupedDetails),
          };
        }),
      );
    } catch (error: unknown) {
      this.logger.error('Error get order list v2', error);
      throw new Error('Error get order list v2');
    }
  }

  // ECWC-399/401/402/403: รวมสถานะจาก order-picking-service + logistics-backend เป็น timeline เดียว
  async getOrderStatus(
    soh_running: string,
    mem_code: string,
  ): Promise<EcomOrderStatusV2Res> {
    const head = await this.shoppingHeadRepo
      .createQueryBuilder('head')
      .where('head.soh_running = :soh_running', { soh_running })
      .andWhere('head.mem_code = :mem_code', { mem_code })
      .select(['head.soh_running'])
      .getOne();
    if (!head) {
      throw new NotFoundException(`Order ${soh_running} not found`);
    }

    const [picking, delivery] = await Promise.all([
      this.fetchPickingStatus(soh_running, mem_code),
      this.fetchDeliveryStatus(soh_running, mem_code),
    ]);

    const status = this.resolveTimelineStatus(picking, delivery);

    return {
      soh_running,
      status,
      status_label: ECOM_ORDER_TIMELINE_LABEL[status],
      picking: picking
        ? {
            picked_time: picking.picked_time,
            qc_time: picking.qc_time,
            price_before_qc: picking.price_before_qc,
            price_after_qc: picking.price_after_qc,
            items: picking.items,
          }
        : null,
      delivery: delivery
        ? {
            driver_name: delivery.driver_name || null,
            driver_tel: delivery.driver_tel,
            checkpoint: delivery.checkpoint,
            finished_at: delivery.finished_at,
            evidence: delivery.evidence,
          }
        : null,
    };
  }

  private resolveTimelineStatus(
    picking: OrderPickingStatusRes | null,
    delivery: LogisticTrackingV2Res | null,
  ): EcomOrderTimelineStatus {
    if (!picking) return 'opened';
    if (picking.status === 'blocked') return 'blocked';
    if (picking.status === 'picking') return 'picking';
    if (picking.status === 'checking') return 'checking';
    // picking.status === 'ready' — QC ผ่านแล้ว รอ handoff ไป logistics
    if (!delivery) return 'waiting_load';
    if (delivery.status === 'DONE') return 'done';
    if (delivery.status === 'BACK') return 'returned';
    return 'delivering';
  }

  private async fetchPickingStatus(
    soh_running: string,
    mem_code: string,
  ): Promise<OrderPickingStatusRes | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<OrderPickingStatusRes>(
          `${this.orderPickingUrl}/api/ecom/order-status/${encodeURIComponent(soh_running)}`,
          { params: { mem_code } },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return null; // ยังไม่ถึง order-picking-service (เพิ่งเปิดบิล)
      }
      this.logger.error('Error fetch picking status', error);
      return null;
    }
  }

  private async fetchDeliveryStatus(
    soh_running: string,
    mem_code: string,
  ): Promise<LogisticTrackingV2Res | null> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<LogisticTrackingV2Res>(
          `${this.logisticUrl}/api/logistic/tracking/v2/by-bill/${encodeURIComponent(soh_running)}`,
          { params: { mem_code } },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      if (error instanceof AxiosError && error.response?.status === 404) {
        return null; // ยังไม่ถึงรอบขึ้นของ/ออกรถ
      }
      this.logger.error('Error fetch delivery status', error);
      return null;
    }
  }
}
