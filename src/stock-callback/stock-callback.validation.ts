import { BadRequestException } from '@nestjs/common';
import {
  STOCK_CALLBACK_STATUSES,
  StockCallbackStatus,
} from './stock-callback.entity';

const text = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t && t.length <= max ? t : null;
};

/** body จากลูกค้า: สินค้า + หน่วย + จำนวนที่พยายามเพิ่ม */
export function parseCustomerRequest(body: unknown): {
  pro_code: string;
  pro_unit: string | null;
  amount: number;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  const pro_code = text(b.pro_code, 30);
  if (!pro_code) throw new BadRequestException('ต้องระบุ pro_code');
  const amount = Number(b.amount);
  if (
    typeof b.amount === 'boolean' ||
    !Number.isInteger(amount) ||
    amount < 1 ||
    amount > 1_000_000
  ) {
    throw new BadRequestException('amount ต้องเป็นจำนวนเต็มบวก');
  }
  return { pro_code, pro_unit: text(b.pro_unit, 100), amount };
}

/** body จากระบบขาย: เปลี่ยนสถานะ + ผู้ดำเนินการ */
export function parseStatusUpdate(body: unknown): {
  status: StockCallbackStatus;
  note: string | null;
  emp_code: string;
  emp_name: string | null;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  const status = b.status;
  if (
    typeof status !== 'string' ||
    !(STOCK_CALLBACK_STATUSES as readonly string[]).includes(status)
  ) {
    throw new BadRequestException(
      `status ต้องเป็น ${STOCK_CALLBACK_STATUSES.join(' / ')}`,
    );
  }
  const emp_code = text(b.emp_code, 30);
  if (!emp_code)
    throw new BadRequestException('ต้องระบุ emp_code ผู้ดำเนินการ');
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') {
    throw new BadRequestException('note ต้องเป็นข้อความ');
  }
  const note =
    typeof b.note === 'string' && b.note.trim()
      ? b.note.trim().slice(0, 1000)
      : null;
  return {
    status: status as StockCallbackStatus,
    note,
    emp_code,
    emp_name: text(b.emp_name, 150),
  };
}

/** query รายการ: status (ไม่ส่ง = ทั้งหมด), q, page, limit */
export function parseListQuery(query: Record<string, unknown>): {
  status: StockCallbackStatus | null;
  q: string | null;
  page: number;
  limit: number;
} {
  const s = query.status;
  let status: StockCallbackStatus | null = null;
  if (s !== undefined && s !== '' && s !== 'all') {
    if (
      typeof s !== 'string' ||
      !(STOCK_CALLBACK_STATUSES as readonly string[]).includes(s)
    ) {
      throw new BadRequestException('status ไม่ถูกต้อง');
    }
    status = s as StockCallbackStatus;
  }
  const int = (v: unknown, def: number, min: number, max: number) => {
    if (v === undefined || v === '') return def;
    const n = Number(v);
    if (typeof v !== 'string' || !/^\d+$/.test(v.trim()) || n < min || n > max)
      throw new BadRequestException('page/limit ไม่ถูกต้อง');
    return n;
  };
  return {
    status,
    q: text(query.q, 100),
    page: int(query.page, 1, 1, 100_000),
    limit: int(query.limit, 50, 1, 200),
  };
}
