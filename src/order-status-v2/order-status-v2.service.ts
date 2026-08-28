import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
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

type PickingBatchStatus = 'picking' | 'checking' | 'ready' | 'blocked';
type DeliveryBatchStatus = 'DELIVERING' | 'DONE' | 'BACK' | 'CANCELLED';

@Injectable()
export class OrderStatusV2Service {
  private readonly logger = new Logger(OrderStatusV2Service.name);
  private readonly orderPickingUrl: string;
  private readonly logisticUrl: string;

  constructor(
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>,
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepo: Repository<ShoppingOrderEntity>,
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
  // ไม่ระบุช่วงวันที่มา = default โชว์เฉพาะ "วันล่าสุด" ที่มีออเดอร์เท่านั้น ไม่ใช่ทั้งหมด
  async getOrderList(
    mem_code: string,
    dateFrom?: string,
    dateTo?: string,
  ): Promise<EcomOrderListV2Res> {
    try {
      let effectiveDateFrom = dateFrom;
      let effectiveDateTo = dateTo;

      if (!dateFrom && !dateTo) {
        const latest = await this.shoppingHeadRepo
          .createQueryBuilder('head')
          .select('DATE(MAX(head.soh_datetime))', 'latestDate')
          .where('head.mem_code = :mem_code', { mem_code })
          .getRawOne<{ latestDate: string | null }>();

        if (latest?.latestDate) {
          effectiveDateFrom = `${latest.latestDate} 00:00:00`;
          effectiveDateTo = `${latest.latestDate} 23:59:59`;
        }
      }

      const query = this.shoppingHeadRepo
        .createQueryBuilder('head')
        .leftJoin('head.details', 'order')
        .leftJoin('order.product', 'product')
        .where('head.mem_code = :mem_code', { mem_code });

      if (effectiveDateFrom) {
        query.andWhere('head.soh_datetime >= :dateFrom', {
          dateFrom: effectiveDateFrom,
        });
      }
      if (effectiveDateTo) {
        query.andWhere('head.soh_datetime <= :dateTo', {
          dateTo: effectiveDateTo,
        });
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

      const shRunnings = result.map((item) => item.soh_running);

      const [orders, pickingBatch, deliveryBatch] = await Promise.all([
        Promise.all(
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
        ),
        this.fetchPickingStatusBatch(shRunnings, mem_code),
        this.fetchDeliveryStatusBatch(shRunnings, mem_code),
      ]);

      return orders.map((order) => {
        const status = this.resolveStatusFromParts(
          pickingBatch[order.soh_running] ?? null,
          deliveryBatch[order.soh_running] ?? null,
        );
        return {
          ...order,
          status,
          status_label: ECOM_ORDER_TIMELINE_LABEL[status],
        };
      });
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

    const [pickingRaw, delivery] = await Promise.all([
      this.fetchPickingStatus(soh_running, mem_code),
      this.fetchDeliveryStatus(soh_running, mem_code),
    ]);

    const picking = pickingRaw
      ? await this.fillFallbackPrices(pickingRaw, soh_running)
      : pickingRaw;

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

  // order-picking-service อาจไม่มีราคาให้ (โดยเฉพาะบิลเก่าที่ archive ไป
  // shopping_order_backup ซึ่งไม่มีคอลัมน์ราคาเลย) — fallback ไปใช้ราคาที่
  // ecommerce เก็บไว้เองตอน checkout (spo_price_unit/spo_total_decimal) แทน
  private async fillFallbackPrices(
    picking: OrderPickingStatusRes,
    soh_running: string,
  ): Promise<OrderPickingStatusRes> {
    const needsFallback =
      picking.price_before_qc === null ||
      picking.price_after_qc === null ||
      picking.items.some(
        (i) => i.so_price_total === null || i.so_price_unit === null,
      );
    if (!needsFallback) return picking;

    const ecomOrders = await this.shoppingOrderRepo.find({
      where: { orderHeader: { soh_running } },
      relations: { product: true },
    });
    if (ecomOrders.length === 0) return picking;

    const priceByProCode = new Map<string, { total: number; unit: number }>();
    for (const o of ecomOrders) {
      const total = Number(o.spo_total_decimal ?? 0);
      const unit = Number(o.spo_price_unit ?? 0);
      const existing = priceByProCode.get(o.pro_code);
      if (existing) {
        existing.total += total;
      } else {
        priceByProCode.set(o.pro_code, { total, unit });
      }
    }

    const items = picking.items.map((item) => {
      if (item.so_price_total !== null && item.so_price_unit !== null) {
        return item;
      }
      const fallback = priceByProCode.get(item.so_procode);
      if (!fallback) return item;

      const priceTotal = item.so_price_total ?? fallback.total;
      const priceUnit = item.so_price_unit ?? fallback.unit;
      return {
        ...item,
        so_price_total: priceTotal,
        so_price_unit: priceUnit,
        qc_price_total: item.qc_price_total ?? (item.is_rt ? 0 : priceTotal),
      };
    });

    const ecomOrderTotal = ecomOrders.reduce(
      (sum, o) => sum + Number(o.spo_total_decimal ?? 0),
      0,
    );

    return {
      ...picking,
      items,
      price_before_qc: picking.price_before_qc ?? ecomOrderTotal,
      price_after_qc: picking.price_after_qc ?? ecomOrderTotal,
    };
  }

  private resolveTimelineStatus(
    picking: OrderPickingStatusRes | null,
    delivery: LogisticTrackingV2Res | null,
  ): EcomOrderTimelineStatus {
    return this.resolveStatusFromParts(
      picking?.status ?? null,
      delivery?.status ?? null,
    );
  }

  private resolveStatusFromParts(
    pickingStatus: PickingBatchStatus | null,
    deliveryStatus: DeliveryBatchStatus | null,
  ): EcomOrderTimelineStatus {
    if (!pickingStatus) return 'opened';
    if (pickingStatus === 'blocked') return 'blocked';
    if (pickingStatus === 'picking') return 'picking';
    if (pickingStatus === 'checking') return 'checking';
    // pickingStatus === 'ready' — QC ผ่านแล้ว รอ handoff ไป logistics
    if (!deliveryStatus) return 'waiting_load';
    if (deliveryStatus === 'DONE') return 'done';
    if (deliveryStatus === 'BACK') return 'returned';
    if (deliveryStatus === 'CANCELLED') return 'cancelled';
    return 'delivering';
  }

  private async fetchPickingStatusBatch(
    sh_running: string[],
    mem_code: string,
  ): Promise<Record<string, PickingBatchStatus>> {
    if (sh_running.length === 0) return {};
    try {
      const response = await firstValueFrom(
        this.httpService.post<Record<string, PickingBatchStatus>>(
          `${this.orderPickingUrl}/api/ecom/order-status/batch`,
          { sh_running, mem_code },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error('Error fetch picking status batch', error);
      return {};
    }
  }

  private async fetchDeliveryStatusBatch(
    sh_running: string[],
    mem_code: string,
  ): Promise<Record<string, DeliveryBatchStatus>> {
    if (sh_running.length === 0) return {};
    try {
      const response = await firstValueFrom(
        this.httpService.post<Record<string, DeliveryBatchStatus>>(
          `${this.logisticUrl}/api/logistic/tracking/batch-by-bill`,
          { sh_running, mem_code },
        ),
      );
      return response.data;
    } catch (error: unknown) {
      this.logger.error('Error fetch delivery status batch', error);
      return {};
    }
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
