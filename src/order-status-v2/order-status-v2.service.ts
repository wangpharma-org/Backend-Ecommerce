import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { UserEntity } from '../users/users.entity';
import { ProductsService } from '../products/products.service';
import {
  ECOM_ORDER_TIMELINE_LABEL,
  EcomOrderDetailV2Res,
  EcomOrderListV2Order,
  EcomOrderListV2Res,
  EcomOrderStatusV2Evidence,
  EcomOrderStatusV2Item,
  EcomOrderStatusV2Res,
  EcomOrderTimelineStatus,
} from './types/order-status-v2.types';
import {
  LegacyOrderDetailProduct,
  LegacyOrderDetailRes,
  LegacyOrderListItem,
  LegacyOrderListProduct,
  LegacyTimelineStep,
} from './types/legacy-order-api.types';

const PICKING_ORDERS_MONTHS_BACK = 3;

// ECWC-4xx: mapping สถานะภายในของเรา → ข้อความ Thai แบบเดียวกับ API เก่าฝั่ง PHP (Akitokung)
// ยืนยันแล้วจากตัวอย่างจริงแค่ 'opened' ("กำลังเปิดบิล") — ที่เหลือ best-effort ตาม pattern เดียวกัน
// รอ QA เทียบกับแอปจริงก่อนเปิด feature flag ใช้งานจริง
const LEGACY_STATUS_LABEL: Record<EcomOrderTimelineStatus, string> = {
  opened: 'กำลังเปิดบิล',
  picking: 'กำลังจัดออเดอร์',
  checking: 'กำลังตรวจสอบออเดอร์',
  waiting_load: 'รอขึ้นของ',
  delivering: 'กำลังจัดส่ง',
  done: 'จัดส่งสำเร็จ',
  blocked: 'ติดปัญหา ติดต่อร้านค้า',
  returned: 'จัดส่งไม่สำเร็จ (ตีกลับ)',
  cancelled: 'ยกเลิกออเดอร์แล้ว',
};

// ECWC-545: ข้อความเตือนสำหรับ legacy API เมื่อบิลตกอยู่ในเคสที่ข้อมูลบางส่วนอาจไม่ครบ/ไม่แม่นยำ
// 100% (ราคาต้อง fallback มาจาก ecommerce เอง หรือสินค้าตัวเดียวกันสั่งหลายหน่วยแล้วโชว์แค่หน่วยแรก)
const LEGACY_DATA_NOTE =
  'ข้อมูลบางส่วนอาจเกิดข้อผิดพลาด หากต้องการข้อมูลที่ถูกต้อง กรุณาติดต่อฝ่ายขาย';

const THAI_MONTHS_ABBR = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

interface PickingOrderDetailItem {
  pro_code: string;
  product_name: string | null;
  qty: number;
  unit: string | null;
  price_unit: number | null;
  price_total: number | null;
}

interface PickingOrderDetailBatchItem {
  sh_running: string;
  sh_datetime: string;
  status: PickingBatchStatus;
  items: PickingOrderDetailItem[];
}

interface OrderPickingStatusRes {
  sh_running: string;
  status: 'picking' | 'checking' | 'ready' | 'blocked';
  picking_time: string | null;
  picked_time: string | null;
  qc_time: string | null;
  items: EcomOrderStatusV2Item[];
  price_before_qc: number | null;
  price_after_qc: number | null;
}

interface LogisticTrackingV2Res {
  status: 'DELIVERING' | 'DONE' | 'BACK';
  store_name: string;
  driver_name: string;
  driver_tel: string | null;
  finished_at: string | null;
  checkpoint: {
    type: 'DEPARTURE' | 'STORE_DELIVERED';
    latitude: string;
    longitude: string;
    time: string | null;
  } | null;
  store_latitude: string | null;
  store_longitude: string | null;
  evidence: EcomOrderStatusV2Evidence | null;
}

type PickingBatchStatus = 'picking' | 'checking' | 'ready' | 'blocked';
type DeliveryBatchStatus = 'DELIVERING' | 'DONE' | 'BACK' | 'CANCELLED';

// การ์ดพร้อม pickingStatus ดิบ — getOrderList ต้อง resolve status สุดท้ายรวมกับ delivery batch
// ของทั้งหน้า (ecom+picking) ทีเดียว ไม่ใช่ resolve แยกตอน build การ์ดแต่ละแหล่ง
interface CardWithPickingStatus {
  card: EcomOrderListV2Order;
  pickingStatus: PickingBatchStatus | null;
}

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
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
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


  // ECWC-398/406/4xx: รายการ order พร้อม filter วันที่ (เลือกเป็นช่วงได้) + pagination — รวมทั้งบิล
  // ปกติของ ecommerce เองและบิลที่มีฝั่ง order-picking-service แต่ไม่มีใน shopping_head ของ
  // ecommerce (เช่น บิลถูก archive/มาจากระบบอื่น) เข้าเป็น pagination เดียวกัน เรียงตามวันที่จริง
  // ไม่ระบุวันที่มา = ดูได้ทั้งหมด, ไม่ระบุ page/pageSize มา = หน้า 1 หน้าละ 10 รายการ
  //
  // แนวทาง: ดึงแค่ soh_running+วันที่ (เบา ไม่ join) จากทั้งสองแหล่งมา merge+sort+slice หาว่า
  // หน้านี้ต้องโชว์บิลไหนบ้างก่อน แล้วค่อยไปดึงรายละเอียดเต็ม (join query/details-batch ที่แพงกว่า)
  // เฉพาะบิลในหน้านั้นจริงๆ — กัน query ระเบิดเวลามีบิลตกหล่นเยอะ (เจอจริง 79-283 บิล/สมาชิก)
  async getOrderList(
    mem_code: string,
    dateFrom?: string,
    dateTo?: string,
    page = 1,
    pageSize = 10,
    sortOrder: 'ASC' | 'DESC' = 'DESC',
  ): Promise<EcomOrderListV2Res> {
    try {
      const safePage = Math.max(1, page);
      const safePageSize = Math.min(100, Math.max(1, pageSize));

      const ecomHeadsQuery = this.shoppingHeadRepo
        .createQueryBuilder('head')
        .where('head.mem_code = :mem_code', { mem_code })
        .select(['head.soh_running', 'head.soh_datetime']);
      if (dateFrom) {
        ecomHeadsQuery.andWhere('head.soh_datetime >= :dateFrom', {
          dateFrom,
        });
      }
      if (dateTo) {
        ecomHeadsQuery.andWhere('head.soh_datetime <= :dateTo', { dateTo });
      }

      const [ecomHeads, pickingEntries] = await Promise.all([
        ecomHeadsQuery.getMany(),
        this.fetchPickingRunnings(mem_code, PICKING_ORDERS_MONTHS_BACK),
      ]);

      // pickingEntries มี status ติดมาด้วยอยู่แล้ว (ย้อนหลังได้ไม่เกิน 3 เดือน — ข้อจำกัดเดียวกับที่
      // หน้า order-list บอกผู้ใช้ไว้อยู่แล้ว) ใช้ตรงนี้แทนการยิง fetchPickingStatusBatch แยกอีกรอบ
      // ให้บิล ecom-sourced ที่อยู่ในช่วงนี้ — ลด round-trip ไป order-picking-service ผ่าน ngrok
      // ที่ช้า (~3s/ครั้ง) เหลือแค่ตอนบิลเก่ากว่า 3 เดือนที่ pickingEntries ไม่ครอบคลุมเท่านั้น
      const pickingStatusByRunning = new Map(
        pickingEntries.map((e) => [e.sh_running, e.status]),
      );

      const ecomRunningSet = new Set(ecomHeads.map((h) => h.soh_running));
      const fromTime = dateFrom ? new Date(dateFrom).getTime() : null;
      const toTime = dateTo ? new Date(dateTo).getTime() : null;
      const missingEntries = pickingEntries.filter((entry) => {
        if (ecomRunningSet.has(entry.sh_running)) return false;
        const t = new Date(entry.sh_datetime).getTime();
        if (fromTime !== null && t < fromTime) return false;
        if (toTime !== null && t > toTime) return false;
        return true;
      });

      type MergedEntry = {
        running: string;
        datetime: Date;
        source: 'ecommerce' | 'order_picking';
      };
      const merged: MergedEntry[] = [
        ...ecomHeads.map((h) => ({
          running: h.soh_running,
          datetime: h.soh_datetime,
          source: 'ecommerce' as const,
        })),
        ...missingEntries.map((e) => ({
          running: e.sh_running,
          datetime: new Date(e.sh_datetime),
          source: 'order_picking' as const,
        })),
      ];
      merged.sort((a, b) =>
        sortOrder === 'ASC'
          ? a.datetime.getTime() - b.datetime.getTime()
          : b.datetime.getTime() - a.datetime.getTime(),
      );

      const total = merged.length;
      const totalPages = total === 0 ? 0 : Math.ceil(total / safePageSize);

      if (total === 0) {
        return {
          data: [],
          total,
          page: safePage,
          pageSize: safePageSize,
          totalPages,
        };
      }

      const pageEntries = merged.slice(
        (safePage - 1) * safePageSize,
        safePage * safePageSize,
      );
      const ecomRunningsForPage = pageEntries
        .filter((e) => e.source === 'ecommerce')
        .map((e) => e.running);
      const pickingRunningsForPage = pageEntries
        .filter((e) => e.source === 'order_picking')
        .map((e) => e.running);
      const allRunningsForPage = pageEntries.map((e) => e.running);

      const [ecomResults, pickingResults, deliveryBatch] = await Promise.all([
        this.buildEcomOrderCards(
          ecomRunningsForPage,
          mem_code,
          sortOrder,
          pickingStatusByRunning,
        ),
        this.buildPickingOrderCards(pickingRunningsForPage, mem_code),
        this.fetchDeliveryStatusBatch(allRunningsForPage, mem_code),
      ]);

      const resultByRunning = new Map<
        string,
        {
          card: EcomOrderListV2Order;
          pickingStatus: PickingBatchStatus | null;
        }
      >();
      for (const r of [...ecomResults, ...pickingResults]) {
        resultByRunning.set(r.card.soh_running, r);
      }

      // status ต้อง resolve ทีเดียวตรงนี้ ไม่ใช่ตอน build card แยกแหล่ง — เพราะตอน build ยังไม่มี
      // delivery batch ของทั้งหน้า (ecom+picking) ที่เพิ่งดึงมาพร้อมกันด้านบน
      const data = pageEntries
        .map((entry) => {
          const r = resultByRunning.get(entry.running);
          if (!r) return null;
          const status = this.resolveStatusFromParts(
            r.pickingStatus,
            deliveryBatch[entry.running] ?? null,
          );
          return {
            ...r.card,
            status,
            status_label: ECOM_ORDER_TIMELINE_LABEL[status],
          };
        })
        .filter((c): c is EcomOrderListV2Order => c !== null);

      return {
        data,
        total,
        page: safePage,
        pageSize: safePageSize,
        totalPages,
      };
    } catch (error: unknown) {
      this.logger.error('Error get order list v2', error);
      throw new Error('Error get order list v2');
    }
  }

  // ดึงรายละเอียดเต็ม + สร้างการ์ดสำหรับ soh_running ที่มีอยู่ใน shopping_head ของ ecommerce เอง
  // คืน pickingStatus ดิบมาด้วยแยกจาก card เพราะ getOrderList ต้อง resolve status สุดท้ายรวมกับ
  // delivery batch ของทั้งหน้า (ecom+picking) ทีเดียว ไม่ใช่ resolve แยกที่นี่
  //
  // knownPickingStatus: มาจาก fetchPickingRunnings ที่ getOrderList ดึงมาแล้ว (ครอบคลุมไม่เกิน 3
  // เดือนย้อนหลัง) ใช้ตรงนี้แทนการยิง fetchPickingStatusBatch ซ้ำ — ยิงเฉพาะ soh_running ที่ไม่อยู่
  // ใน map นี้ (บิลเก่ากว่า 3 เดือน) เท่านั้น กัน round-trip ไป order-picking-service โดยไม่จำเป็น
  private async buildEcomOrderCards(
    soh_runnings: string[],
    mem_code: string,
    sortOrder: 'ASC' | 'DESC',
    knownPickingStatus: Map<string, PickingBatchStatus>,
  ): Promise<CardWithPickingStatus[]> {
    if (soh_runnings.length === 0) return [];

    const result = await this.shoppingHeadRepo
      .createQueryBuilder('head')
      .leftJoin('head.details', 'order')
      .leftJoin('order.product', 'product')
      .where('head.soh_running IN (:...soh_runnings)', { soh_runnings })
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
      .orderBy('head.soh_datetime', sortOrder)
      .getMany();

    const shRunnings = result.map((item) => item.soh_running);
    const unknownStatusRunnings = shRunnings.filter(
      (sh) => !knownPickingStatus.has(sh),
    );

    const [orders, fetchedPickingBatch] = await Promise.all([
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

            // สินค้าเก่า/ยกเลิกขายบางตัวไม่มีข้อมูล unit แล้ว calculateSmallestUnit จะ throw
            // ทั้งบิล — กันไม่ให้บิลอื่นในหน้าเดียวกันแสดงผลไม่ได้ไปด้วย fallback เป็น 0 ต่อรายการ
            const totalSmallestUnit = await Promise.all(
              Object.values(groupedDetails).map(async (group) => {
                const orderItems = group.items.map((line) => ({
                  unit: line.spo_unit,
                  quantity: parseFloat(String(line.spo_qty)),
                  pro_code: group.pro_code,
                }));
                try {
                  return await this.productService.calculateSmallestUnit(
                    orderItems,
                  );
                } catch (error: unknown) {
                  this.logger.error(
                    `Error calculating smallest unit for pro_code ${group.pro_code} (soh_running ${item.soh_running})`,
                    error,
                  );
                  return 0;
                }
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
      unknownStatusRunnings.length > 0
        ? this.fetchPickingStatusBatch(unknownStatusRunnings, mem_code)
        : Promise.resolve({}),
    ]);

    // status/status_label ตรงนี้เป็นค่า placeholder เท่านั้น — getOrderList resolve ค่าจริงจาก
    // pickingStatus (คืนแยกไปด้วย) รวมกับ delivery batch ของทั้งหน้าอีกที
    return orders.map((order) => ({
      card: {
        ...order,
        status: 'opened' as EcomOrderTimelineStatus,
        status_label: ECOM_ORDER_TIMELINE_LABEL.opened,
      },
      pickingStatus:
        knownPickingStatus.get(order.soh_running) ??
        fetchedPickingBatch[order.soh_running] ??
        null,
    }));
  }

  // ดึงรายละเอียดเต็ม + สร้างการ์ดสำหรับ sh_running ที่มีเฉพาะฝั่ง order-picking-service
  // คืน pickingStatus ดิบมาด้วยแยกจาก card เหมือน buildEcomOrderCards
  private async buildPickingOrderCards(
    sh_runnings: string[],
    mem_code: string,
  ): Promise<CardWithPickingStatus[]> {
    if (sh_runnings.length === 0) return [];

    const details = await this.fetchPickingOrderDetailsBatch(
      mem_code,
      sh_runnings,
    ).catch((error: unknown) => {
      this.logger.error('Error fetch picking order details batch', error);
      return [] as PickingOrderDetailBatchItem[];
    });
    if (details.length === 0) return [];

    const allProCodes = [
      ...new Set(details.flatMap((d) => d.items.map((i) => i.pro_code))),
    ];
    const productInfoByProCode =
      await this.productService.getProductInfoByCodes(allProCodes);

    return Promise.all(
      details.map((detail) =>
        this.buildMissingOrderCard(detail, productInfoByProCode),
      ),
    );
  }

  private async buildMissingOrderCard(
    detail: PickingOrderDetailBatchItem,
    productInfoByProCode: Map<
      string,
      { pro_name: string; pro_imgmain: string }
    >,
  ): Promise<CardWithPickingStatus> {
    const groupedDetails: Record<
      string,
      {
        pro_code: string;
        product: { pro_code: string; pro_imgmain: string };
        items: { spo_id: number; spo_qty: number; spo_unit: string }[];
      }
    > = {};

    detail.items.forEach((item, index) => {
      if (!groupedDetails[item.pro_code]) {
        groupedDetails[item.pro_code] = {
          pro_code: item.pro_code,
          product: {
            pro_code: item.pro_code,
            pro_imgmain:
              productInfoByProCode.get(item.pro_code)?.pro_imgmain ?? '',
          },
          items: [],
        };
      }
      groupedDetails[item.pro_code].items.push({
        spo_id: index,
        spo_qty: item.qty,
        spo_unit: item.unit ?? '',
      });
    });

    // เหตุผลเดียวกับ getOrderList — สินค้าเก่า/ยกเลิกขายไม่มี unit แล้ว calculateSmallestUnit จะ throw
    const totalSmallestUnit = await Promise.all(
      Object.values(groupedDetails).map(async (group) => {
        const orderItems = group.items.map((line) => ({
          unit: line.spo_unit,
          quantity: line.spo_qty,
          pro_code: group.pro_code,
        }));
        try {
          return await this.productService.calculateSmallestUnit(orderItems);
        } catch (error: unknown) {
          this.logger.error(
            `Error calculating smallest unit for pro_code ${group.pro_code} (sh_running ${detail.sh_running})`,
            error,
          );
          return 0;
        }
      }),
    );

    const soh_sumprice = detail.items.reduce(
      (sum, i) => sum + (i.price_total ?? (i.price_unit ?? 0) * i.qty),
      0,
    );

    // status/status_label ตรงนี้เป็นค่า placeholder — getOrderList resolve ค่าจริงจาก pickingStatus
    // (คืนแยกไปด้วย) รวมกับ delivery batch ของทั้งหน้าอีกที
    return {
      card: {
        soh_running: detail.sh_running,
        soh_datetime: new Date(detail.sh_datetime),
        soh_sumprice,
        soh_coin_recieve: 0,
        details: detail.items.length,
        totalSmallestUnit: Object.values(groupedDetails).map(
          (group, index) => ({
            pro_code: group.pro_code,
            totalSmallestUnit: totalSmallestUnit[index],
          }),
        ),
        Newdetails: Object.values(groupedDetails),
        status: 'opened',
        status_label: ECOM_ORDER_TIMELINE_LABEL.opened,
      },
      pickingStatus: detail.status,
    };
  }

  // ECWC-4xx: รายละเอียดเต็มของบิลสำหรับหน้า Track — ดึงจาก order-picking-service เสมอไม่ว่า
  // บิลนั้นจะมีใน shopping_head ของ ecommerce เองหรือไม่ (แทนที่ SomeOrderByMember เดิมซึ่งใช้ได้
  // เฉพาะบิลที่ ecommerce มีข้อมูลเอง) — ไม่มี soh_payment_type/discount จริงเพราะเป็นข้อมูลฝั่ง
  // checkout ของ ecommerce ที่ไม่ได้ส่งต่อไปคลัง ฝั่ง frontend ต้องโชว์ข้อความอธิบายแทน
  async getOrderDetail(
    soh_running: string,
    mem_code: string,
  ): Promise<EcomOrderDetailV2Res> {
    const { detail } = await this.getOrderDetailWithMeta(soh_running, mem_code);
    return detail;
  }

  // ECWC-545: เหมือน getOrderDetail แต่ส่ง usedPriceFallback กลับมาด้วย ให้ legacy order-detail
  // เอาไปตัดสินใจใส่ note เตือนความแม่นยำของราคา โดยไม่ต้องเพิ่ม field แปลกปลอมใน
  // EcomOrderDetailV2Res ที่หน้า Track (normal flow) ใช้อยู่
  private async getOrderDetailWithMeta(
    soh_running: string,
    mem_code: string,
  ): Promise<{ detail: EcomOrderDetailV2Res; usedPriceFallback: boolean }> {
    // ต่างจาก getMissingOrders ตรงนี้ต้อง "ไม่" กลืน error ที่นี่ — ผู้ใช้เปิดดูบิลนี้ตรงๆ
    // ถ้าเชื่อมต่อ order-picking-service ไม่ได้ (network/timeout/5xx) ต้องรายงานเป็น 503
    // ไม่ใช่โกหกว่า "ไม่พบคำสั่งจอง" เพราะ NotFoundException สงวนไว้สำหรับกรณีที่เรียกสำเร็จ
    // แล้ว order-picking-service ตอบกลับมาว่าไม่มีบิลนี้จริงๆ เท่านั้น
    let details: PickingOrderDetailBatchItem[];
    let delivery: LogisticTrackingV2Res | null;
    try {
      [details, delivery] = await Promise.all([
        this.fetchPickingOrderDetailsBatch(mem_code, [soh_running]),
        this.fetchDeliveryStatus(soh_running, mem_code),
      ]);
    } catch (error: unknown) {
      this.logger.error(
        `Error fetch picking order detail for ${soh_running}`,
        error,
      );
      throw new ServiceUnavailableException(
        'ไม่สามารถเชื่อมต่อระบบคลังได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      );
    }

    const detail = details[0];
    if (!detail) {
      throw new NotFoundException(`Order ${soh_running} not found`);
    }

    // บิลเก่าที่ archive ไป shopping_order_backup ฝั่งคลังมักไม่มีคอลัมน์ราคาเลย (null ทุกช่อง)
    // แม้บิลนั้นจะมีอยู่ใน shopping_order ของ ecommerce เองก็ตาม (เจอจริงจาก QA — so_price_unit/
    // so_price_total เป็น null หมดทั้งบิล ทั้งที่ ecommerce มีราคาเก็บไว้ตอน checkout)
    const { items, usedFallback: usedPriceFallback } =
      await this.fillFallbackPricesForItems(detail.items, soh_running);

    const proCodes = [...new Set(items.map((i) => i.pro_code))];
    const productInfoByProCode =
      await this.productService.getProductInfoByCodes(proCodes);

    const soh_sumprice = items.reduce(
      (sum, i) => sum + (i.price_total ?? (i.price_unit ?? 0) * i.qty),
      0,
    );

    const status = this.resolveStatusFromParts(
      detail.status,
      delivery?.status ?? null,
    );

    const res: EcomOrderDetailV2Res = {
      soh_running: detail.sh_running,
      soh_datetime: new Date(detail.sh_datetime),
      soh_sumprice,
      soh_payment_type: null,
      discount: 0,
      status,
      status_label: ECOM_ORDER_TIMELINE_LABEL[status],
      details: items.map((item, index) => ({
        spo_id: index,
        spo_qty: item.qty,
        spo_unit: item.unit ?? '',
        spo_price_unit: item.price_unit,
        spo_total_decimal: item.price_total,
        product: {
          pro_code: item.pro_code,
          pro_name:
            item.product_name ??
            productInfoByProCode.get(item.pro_code)?.pro_name ??
            null,
          pro_imgmain:
            productInfoByProCode.get(item.pro_code)?.pro_imgmain ?? '',
        },
      })),
    };

    return { detail: res, usedPriceFallback };
  }

  private async fetchPickingRunnings(
    mem_code: string,
    monthsBack: number,
  ): Promise<
    { sh_running: string; sh_datetime: string; status: PickingBatchStatus }[]
  > {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          entries: {
            sh_running: string;
            sh_datetime: string;
            status: PickingBatchStatus;
          }[];
        }>(
          `${this.orderPickingUrl}/api/ecom/order-status/runnings/${encodeURIComponent(mem_code)}`,
          { params: { months_back: monthsBack } },
        ),
      );
      // กัน order-picking-service เวอร์ชันเก่าที่ยังไม่ได้ deploy โค้ดใหม่ (ตอบ { sh_running: [...] }
      // แทน { entries: [...] }) — ไม่งั้น .filter() ต่อจาก undefined จะพังทั้ง endpoint
      return response.data.entries ?? [];
    } catch (error: unknown) {
      this.logger.error('Error fetch picking runnings', error);
      return [];
    }
  }

  // ไม่ catch error ที่นี่ตั้งใจ — ปล่อยให้ผู้เรียกตัดสินใจเอง เพราะ "เรียก order-picking-service
  // ไม่สำเร็จ" (network/timeout/5xx) กับ "เรียกสำเร็จแต่ order-picking-service บอกว่าไม่มีบิลนี้"
  // (array ว่างเปล่า) ต้องแยกกัน ถ้ากลืน error แล้วคืน [] เหมือนกันหมด getOrderDetail จะรายงาน
  // "Order not found" ผิดๆ ทั้งที่จริงแค่เชื่อมต่อ order-picking-service ไม่ได้ชั่วคราว
  private async fetchPickingOrderDetailsBatch(
    mem_code: string,
    sh_running: string[],
  ): Promise<PickingOrderDetailBatchItem[]> {
    const response = await firstValueFrom(
      this.httpService.post<PickingOrderDetailBatchItem[]>(
        `${this.orderPickingUrl}/api/ecom/order-status/details-batch`,
        { sh_running, mem_code },
      ),
    );
    return response.data;
  }

  // ECWC-399/401/402/403: รวมสถานะจาก order-picking-service + logistics-backend เป็น timeline เดียว
  // มีของบิลได้ 2 ทาง: (1) เพิ่งเปิดบิล มีแค่ใน shopping_head ของ ecommerce ยังไม่ถึงคลัง
  // หรือ (2) มีเฉพาะฝั่ง order-picking-service (บิลตกหล่น/เก่า) — เช็คตัวใดตัวหนึ่งเจอก็พอ
  // ไม่บังคับว่าต้องมีใน shopping_head เหมือนเดิม (ทำให้บิลตกหล่นเปิดหน้านี้ไม่ได้มาก่อน)
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

    let pickingRaw: OrderPickingStatusRes | null;
    let delivery: LogisticTrackingV2Res | null;
    try {
      [pickingRaw, delivery] = await Promise.all([
        this.fetchPickingStatus(soh_running, mem_code),
        this.fetchDeliveryStatus(soh_running, mem_code),
      ]);
    } catch (error: unknown) {
      this.logger.error(`Error fetch picking status for ${soh_running}`, error);
      throw new ServiceUnavailableException(
        'ไม่สามารถเชื่อมต่อระบบคลังได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
      );
    }

    if (!head && !pickingRaw) {
      throw new NotFoundException(`Order ${soh_running} not found`);
    }

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
            picking_time: picking.picking_time,
            picked_time: picking.picked_time,
            qc_time: picking.qc_time,
            price_before_qc: picking.price_before_qc,
            price_after_qc: picking.price_after_qc,
            items: picking.items,
          }
        : null,
      delivery: delivery
        ? {
            store_name: delivery.store_name,
            driver_name: delivery.driver_name || null,
            driver_tel: delivery.driver_tel,
            checkpoint: delivery.checkpoint,
            store_latitude: delivery.store_latitude,
            store_longitude: delivery.store_longitude,
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

    // คำนวณยอดใหม่จาก items หลังเติม fallback แล้ว — ห้ามใช้ picking.price_before_qc/
    // price_after_qc เดิมต่อ เพราะเป็นยอดที่ order-picking-service sum มาก่อนเติม fallback
    // (รายการที่ตอนนั้นราคายัง null จะถูกนับเป็น 0 ปนอยู่ในยอดเดิม ทำให้ยอดขาดไปโดยไม่รู้ตัว)
    const price_before_qc = items.every((i) => i.so_price_total === null)
      ? null
      : items.reduce((sum, i) => sum + (i.so_price_total ?? 0), 0);
    const price_after_qc = items.every((i) => i.qc_price_total === null)
      ? null
      : items.reduce((sum, i) => sum + (i.qc_price_total ?? 0), 0);

    return {
      ...picking,
      items,
      price_before_qc: price_before_qc ?? ecomOrderTotal,
      price_after_qc: price_after_qc ?? ecomOrderTotal,
    };
  }

  // ECWC-545: เหตุผลเดียวกับ fillFallbackPrices — บิลเก่าที่ archive ไป shopping_order_backup
  // ฝั่งคลังมักไม่มีคอลัมน์ราคาเลย ต้อง fallback ไปใช้ราคาที่ ecommerce เก็บไว้เองตอน checkout
  // (spo_price_unit/spo_total_decimal) แทน — ใช้กับ getOrderDetail (โครงสร้าง item ต่างจาก
  // fillFallbackPrices เดิมที่ทำงานกับ OrderPickingStatusRes ของ getOrderStatus)
  //
  // ข้อจำกัด: fallback เป็นราคาเฉลี่ยต่อ pro_code (รวมทุกบรรทัดที่ pro_code เดียวกัน) ถ้าบิลมี
  // สินค้าตัวเดียวกันสั่งหลายหน่วยต่างกัน (เช่น "แผง" กับ "กล10แผง") ราคาต่อหน่วยที่ fallback มา
  // อาจไม่ตรงเป๊ะทุกบรรทัด แต่ยอดรวมทั้ง pro_code ยังถูกต้อง
  private async fillFallbackPricesForItems(
    items: PickingOrderDetailItem[],
    soh_running: string,
  ): Promise<{ items: PickingOrderDetailItem[]; usedFallback: boolean }> {
    const needsFallback = items.some(
      (i) => i.price_total === null || i.price_unit === null,
    );
    if (!needsFallback) return { items, usedFallback: false };

    const ecomOrders = await this.shoppingOrderRepo.find({
      where: { orderHeader: { soh_running } },
    });
    if (ecomOrders.length === 0) return { items, usedFallback: false };

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

    let usedFallback = false;
    const filledItems = items.map((item) => {
      if (item.price_total !== null && item.price_unit !== null) {
        return item;
      }
      const fallback = priceByProCode.get(item.pro_code);
      if (!fallback) return item;
      usedFallback = true;
      return {
        ...item,
        price_total: item.price_total ?? fallback.total,
        price_unit: item.price_unit ?? fallback.unit,
      };
    });

    return { items: filledItems, usedFallback };
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
        return null; // ยังไม่ถึง order-picking-service (เพิ่งเปิดบิล) หรือ mem_code ไม่ตรงเจ้าของ
      }
      // network/timeout/5xx จริงๆ ต้องโยนต่อ ไม่ใช่กลืนแล้วคืน null เหมือน "ไม่พบ" เฉยๆ
      // (ผู้เรียก getOrderStatus ใช้ null ตรงนี้เป็นสัญญาณว่า "ยังไม่ถึงคลัง" ไม่ใช่ "เชื่อมต่อไม่ได้")
      throw error;
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

  private formatThaiDate(date: Date, withTime = false): string {
    const d = String(date.getDate()).padStart(2, '0');
    const m = THAI_MONTHS_ABBR[date.getMonth()];
    const y = date.getFullYear() + 543;
    if (!withTime) return `${d} ${m} ${y}`;
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${d} ${m} ${hh}:${mm}`;
  }

  private resolveLegacyImageUrl(pro_imgmain: string): string {
    return pro_imgmain?.startsWith('..')
      ? `https://www.wangpharma.com${pro_imgmain.slice(2)}`
      : pro_imgmain;
  }

  private buildMemberAddressText(member: UserEntity): string {
    return [
      member.mem_address,
      member.mem_village ? `หมู่บ้าน${member.mem_village}` : '',
      member.mem_alley ? `ซอย${member.mem_alley}` : '',
      member.mem_tumbon ? `ต.${member.mem_tumbon}` : '',
      member.mem_amphur ? `อ.${member.mem_amphur}` : '',
      member.mem_province ? `จ.${member.mem_province}` : '',
      member.mem_post ?? '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  // ECWC-4xx: clone ของ Akitokung/api/order/order_list.php (PHP เก่า) ให้ mobile app สลับมาเรียก
  // endpoint นี้แทนได้ — คุมด้วย feature flag 'new_order_list_api' (ดูจุด flag check ที่ controller)
  //
  // status='uncompleted'|'completed' filter หลังดึงข้อมูลมาแล้ว (getOrderList ไม่รองรับ filter
  // ตาม bucket แบบนี้) — ดึงมาทีเดียว pageSize สูงสุด (100) แล้ว filter+slice เอาตาม limit/offset
  // เอง ใช้ได้ตราบใดที่จำนวนบิลทั้งหมดของสมาชิกไม่เกิน 100 ใบ (ปกติกรณี uncompleted มีไม่กี่ใบ)
  async getLegacyOrderList(
    mem_code: string,
    status: string | undefined,
    limit: number,
    offset: number,
  ): Promise<LegacyOrderListItem[]> {
    const [result, member] = await Promise.all([
      this.getOrderList(mem_code, undefined, undefined, 1, 100, 'DESC'),
      this.userRepo.findOne({ where: { mem_code } }),
    ]);

    let filtered = result.data;
    if (status === 'uncompleted') {
      filtered = filtered.filter(
        (o) => !['done', 'cancelled', 'returned'].includes(o.status),
      );
    } else if (status === 'completed') {
      filtered = filtered.filter((o) =>
        ['done', 'cancelled', 'returned'].includes(o.status),
      );
    }

    const addressText = member ? this.buildMemberAddressText(member) : '';
    const page = filtered.slice(offset, offset + limit);

    return page.map((order) => this.buildLegacyOrderListItem(order, addressText));
  }

  private buildLegacyOrderListItem(
    order: EcomOrderListV2Order,
    addressText: string,
  ): LegacyOrderListItem {
    // ก่อนหน้านี้ amountUnit ใช้ totalSmallestUnit (แปลงหน่วยรวมทุกบรรทัดของ pro_code นั้น) แต่
    // Unit ใช้หน่วยดิบของบรรทัดแรก — ถ้า pro_code เดียวกันสั่งหลายหน่วยไม่เท่ากัน (เช่น "แผง" กับ
    // "กล10แผง") จะจับคู่ตัวเลข/หน่วยผิดกัน (เจอจริงจาก QA เช่น "100 บาท" ที่ไม่ใช่หน่วยสินค้าเลย)
    // แก้โดยใช้ qty+unit จากบรรทัดเดียวกันเสมอ (ไม่แปลงหน่วย) — เสียความละเอียดกรณีสั่งหลายหน่วย
    // แต่ได้ความถูกต้องของคู่ตัวเลข/หน่วยแทน
    const products: LegacyOrderListProduct[] = order.Newdetails.map((d) => ({
      thumbnail: this.resolveLegacyImageUrl(d.product.pro_imgmain),
      pro_code: d.product.pro_code,
      amountUnit: d.items[0]?.spo_qty ?? 0,
      Unit: d.items[0]?.spo_unit ?? '',
    }));

    // มี pro_code เดียวกันสั่งหลายหน่วยในบิลนี้ → เราโชว์ได้แค่หน่วยแรกต่อ pro_code (ดูคอมเมนต์
    // ด้านบน) เลยต้องเตือนว่าจำนวน/หน่วยที่แสดงอาจไม่ครบ
    const hasMultiUnitProduct = order.Newdetails.some(
      (d) => d.items.length > 1,
    );

    return {
      orderNo: order.soh_running,
      status: LEGACY_STATUS_LABEL[order.status],
      // title: สูตรวันที่ "จะได้รับสินค้าภายใน" จริงของ PHP ยังไม่ทราบ — ใช้ soh_datetime ไปก่อน
      // ตามที่ตกลง (ยังไม่ refine)
      title: `จะได้รับสินค้าภายใน ${this.formatThaiDate(order.soh_datetime)}`,
      body: addressText,
      date: this.formatThaiDate(order.soh_datetime),
      point: 0, // ตามที่ตกลง — ไม่ต้องแสดงค่าจริง
      price: order.soh_sumprice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      products,
      note: hasMultiUnitProduct ? LEGACY_DATA_NOTE : null,
    };
  }

  // ECWC-4xx: clone ของ Akitokung/api/order/order_detial.php (PHP เก่า สะกดตามต้นฉบับ) — คุมด้วย
  // feature flag 'new_order_detail_api'
  //
  // ช่องว่างที่รู้อยู่แล้ว (best-effort รอ QA เทียบแอปจริง):
  // - timeline: PHP มีหลาย sub-event/ต่อ step พร้อมเวลาละเอียด เราไม่มีข้อมูลระดับนั้น สร้างแค่
  //   1 entry ต่อ step ที่รู้จริงจากข้อมูลที่มี
  // - shipping_price/gimmick_point: hardcode ตามตัวอย่างจริงที่เห็น ยังไม่มี logic ค่าส่ง/แต้มจริง
  // - discount รายชิ้น/qc_amount: ไม่มีข้อมูลระดับนี้ในโครงสร้างใหม่ ใส่ 0 ไปก่อน
  // - pay_type: เป็น null ถ้าบิลมาจาก order-picking-service เพราะไม่มีข้อมูลนี้จริง (บิลตกหล่น)
  async getLegacyOrderDetail(
    soh_running: string,
    mem_code: string,
  ): Promise<LegacyOrderDetailRes> {
    const [{ detail, usedPriceFallback }, member] = await Promise.all([
      this.getOrderDetailWithMeta(soh_running, mem_code),
      this.userRepo.findOne({ where: { mem_code } }),
    ]);

    const products: LegacyOrderDetailProduct[] = detail.details.map(
      (item) => ({
        thumbnail: this.resolveLegacyImageUrl(item.product.pro_imgmain),
        pro_code: item.product.pro_code,
        pro_name: item.product.pro_name,
        order_amount: String(item.spo_qty),
        Unit: item.spo_unit,
        price_unit: (item.spo_price_unit ?? 0).toFixed(2),
        discount: '0.00',
        price_total: (item.spo_total_decimal ?? 0).toFixed(2),
        qc_amount: 0,
      }),
    );

    const timeline = this.buildLegacyTimeline(detail);
    const netPrice = detail.soh_sumprice - detail.discount;

    return {
      orderNo: detail.soh_running,
      timeline,
      shipping: {
        name: member?.mem_nameSite ?? '',
        address: member ? this.buildMemberAddressText(member) : '',
        phone: member?.mem_phone ?? '',
      },
      products,
      total_list: String(detail.details.length),
      total_price: detail.soh_sumprice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      discount_price: detail.discount.toFixed(2),
      shipping_price: 'ฟรี (-50.00)',
      gimmick_point: '0.00',
      sumprice: netPrice.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      pay_type: detail.soh_payment_type ?? '',
      orderTime: this.formatThaiDate(detail.soh_datetime, true),
      No_order: detail.soh_running,
      note: usedPriceFallback ? LEGACY_DATA_NOTE : null,
    };
  }

  private buildLegacyTimeline(
    detail: EcomOrderDetailV2Res,
  ): LegacyTimelineStep[] {
    const steps: LegacyTimelineStep[] = [
      {
        status: LEGACY_STATUS_LABEL.opened,
        detail: [
          {
            title: LEGACY_STATUS_LABEL.opened,
            detail: `ลูกค้าส่งคำสั่งซื้อเรียบร้อย [${detail.soh_running}]`,
            dateText: this.formatThaiDate(detail.soh_datetime, true),
          },
        ],
      },
    ];

    if (detail.status !== 'opened') {
      steps.push({
        status: LEGACY_STATUS_LABEL[detail.status],
        detail: [
          {
            title: LEGACY_STATUS_LABEL[detail.status],
            detail: detail.status_label,
            dateText: '',
          },
        ],
      });
    }

    return steps;
  }
}
