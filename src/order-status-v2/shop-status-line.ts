import { ShopStatusLine } from './types/order-status-v2.types';

// รายการหนึ่งจาก order-picking `POST /api/ecom/order-status/details-batch`
// qc_* มาทีหลัง (SSN0-367) — order-picking เวอร์ชันเก่าไม่ส่ง จึงเป็น optional
export interface PickingOrderDetailItem {
  pro_code: string;
  product_name: string | null;
  qty: number;
  unit: string | null;
  price_unit: number | null;
  price_total: number | null;
  // ราคาหลัง QC (RT → 0, ตรวจนับขาด → คิดตามจำนวนจริง, ยังไม่ตรวจนับ → เท่า price_total) — ECWC-4xx
  qc_price_total: number | null;
  is_rt: boolean;
  qc_status?: 'pending' | 'complete' | 'short' | 'rt' | 'unknown';
  qc_qty?: number | null;
  qc_note?: string | null;
  change_from_procode?: string | null;
}

// order-picking คิด qc_price_total = qc_qty × price_unit เป็น float (3 × 27.9 = 83.6999…)
// เทียบตรงๆ กับ price_total 83.7 จะขึ้น "ตรวจนับขาด" ทั้งที่ได้ครบ — เผื่อครึ่งสตางค์
const PRICE_EPSILON = 0.005;

// SSN0-367: ฝ่ายขายต้องแจ้งลูกค้าเป็นจำนวน (สั่ง 10 ได้ 6 ขาด 4)
// short คิดจากจำนวนเมื่อมีผล QC — แบบเดิมเทียบราคา บิลที่ไม่มีราคา (บิลพนักงานคีย์) จึงไม่เคยขึ้นว่าไม่ครบ
export function toShopStatusLine(it: PickingOrderDetailItem): ShopStatusLine {
  const qty = Number(it.qty);
  const received =
    it.qc_qty === undefined || it.qc_qty === null ? null : Number(it.qc_qty);
  const missing = received === null ? null : Math.max(qty - received, 0);
  const short =
    it.qc_status !== undefined
      ? !it.is_rt && missing !== null && missing > 0
      : !it.is_rt &&
        it.qc_price_total != null &&
        it.price_total != null &&
        it.qc_price_total < it.price_total - PRICE_EPSILON;
  return {
    pro_code: it.pro_code,
    pro_name: it.product_name,
    qty,
    unit: it.unit,
    price_unit: it.price_unit,
    price_total: it.price_total,
    qc_price_total: it.qc_price_total,
    out_of_stock: it.is_rt,
    short,
    received_qty: received,
    missing_qty: missing,
    qc_note: it.qc_note ?? null,
    changed_from: it.change_from_procode ?? null,
  };
}
