import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';

// ใบวางบิล / ใบลดหนี้ที่นำเข้าที่นี่ ส่งต่อทั้งชุดให้ระบบขาย (SSN0-365)
// Ecom → Wang-Kafka-API-Service (HTTP) → topic → sale-backend แทนที่ตาราง ecom_* ทั้งชุดเมื่อได้ครบทุกก้อน
// เปิดด้วย SALE_RECEIVABLES_SYNC_ENABLED=true + WANG_MICROSERVICE_API (ปิดอยู่ = ไม่ส่ง ไม่กระทบการนำเข้า)
export type SaleReceivablesKind = 'billing_slip' | 'credit_note';

const KAFKA_API_PATH: Record<SaleReceivablesKind, string> = {
  billing_slip: '/api/kafka/ecom-billing-slip-sync',
  credit_note: '/api/kafka/ecom-credit-note-sync',
};

// body ของ Kafka-API จำกัด 100kb — เผื่อซอง/ส่วนหัว HTTP ไว้
export const MAX_PART_BYTES = 90_000;
export const MAX_ITEMS_PER_PART = 1000;
const REQUEST_TIMEOUT_MS = 10_000;

export interface PartPlan<T> {
  parts: T[][];
  // ใบที่ใหญ่เกินก้อนเดียว (บิลย่อยหลายร้อยใบ) — ส่งไม่ได้ ข้ามแล้วแจ้ง error
  oversized: T[];
}

const byteLength = (value: unknown) =>
  Buffer.byteLength(JSON.stringify(value), 'utf8');

// แบ่ง items เป็นก้อนตามขนาด JSON (≤ maxBytes) และจำนวน (≤ maxItems) — ชุดว่าง = 1 ก้อนว่าง
export function planParts<T>(
  items: T[],
  maxBytes = MAX_PART_BYTES,
  maxItems = MAX_ITEMS_PER_PART,
): PartPlan<T> {
  const parts: T[][] = [];
  const oversized: T[] = [];
  let current: T[] = [];
  let currentBytes = 2; // []
  for (const item of items) {
    const size = byteLength(item) + 1; // คอมมา
    if (size + 2 > maxBytes) {
      oversized.push(item);
      continue;
    }
    if (current.length >= maxItems || currentBytes + size > maxBytes) {
      parts.push(current);
      current = [];
      currentBytes = 2;
    }
    current.push(item);
    currentBytes += size;
  }
  if (current.length > 0 || parts.length === 0) parts.push(current);
  return { parts, oversized };
}

export type SyncResult =
  | { status: 'disabled' }
  | { status: 'sent'; importId: string; parts: number; skipped: number }
  | { status: 'failed'; importId: string; reason: string };

@Injectable()
export class SaleReceivablesSyncService {
  private readonly logger = new Logger(SaleReceivablesSyncService.name);

  // ส่งทั้งชุดที่เพิ่งนำเข้า — ไม่ throw: การนำเข้าของ Ecom สำเร็จแล้ว ระบบขายแค่ได้ชุดถัดไปแทน
  // ส่งไม่ครบ = ระบบขายไม่ลงชุดนี้ (ข้อมูลเดิมยังอยู่) · log error ทุกกรณีที่ไม่ได้ส่ง
  async forward(
    kind: SaleReceivablesKind,
    items: unknown[],
  ): Promise<SyncResult> {
    if (process.env.SALE_RECEIVABLES_SYNC_ENABLED !== 'true') {
      return { status: 'disabled' };
    }
    const importId = randomUUID();
    const baseUrl = (process.env.WANG_MICROSERVICE_API || '').replace(
      /\/+$/,
      '',
    );
    if (!baseUrl) {
      const reason =
        'SALE_RECEIVABLES_SYNC_ENABLED=true แต่ไม่ได้ตั้ง WANG_MICROSERVICE_API';
      this.logger.error(`${kind} sync: ${reason}`);
      return { status: 'failed', importId, reason };
    }

    const exportedAt = new Date().toISOString();
    const { parts, oversized } = planParts(Array.isArray(items) ? items : []);
    if (oversized.length > 0) {
      this.logger.error(
        `${kind} sync ${importId}: skipped ${oversized.length} item(s) larger than ${MAX_PART_BYTES} bytes — ${oversized
          .slice(0, 10)
          .map((item) => String((item as { invoice?: unknown })?.invoice))
          .join(', ')}`,
      );
    }

    for (let index = 0; index < parts.length; index++) {
      try {
        await axios.post(
          `${baseUrl}${KAFKA_API_PATH[kind]}`,
          {
            importId,
            exportedAt,
            part: index + 1,
            parts: parts.length,
            items: parts[index],
          },
          { timeout: REQUEST_TIMEOUT_MS },
        );
      } catch (error: unknown) {
        const reason = axios.isAxiosError(error)
          ? `${error.response?.status ?? error.code ?? 'network'} ${JSON.stringify(error.response?.data ?? error.message)}`
          : error instanceof Error
            ? error.message
            : String(error);
        this.logger.error(
          `${kind} sync ${importId}: part ${index + 1}/${parts.length} failed — ${reason}`,
        );
        return { status: 'failed', importId, reason };
      }
    }
    this.logger.log(
      `${kind} sync ${importId}: sent ${parts.length} part(s), skipped ${oversized.length}`,
    );
    return {
      status: 'sent',
      importId,
      parts: parts.length,
      skipped: oversized.length,
    };
  }
}
