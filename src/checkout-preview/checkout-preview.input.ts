/// ตรวจ body ของ POST /ecom/internal/checkout-preview — ระบบขายส่งรายการสินค้าของใบที่กำลังคีย์มาถาม

export const CHECKOUT_PREVIEW_MAX_LINES = 300;

export interface CheckoutPreviewInput {
  mem_code: string;
  lines: { pro_code: string; unit: string; qty: number }[];
  redeem: { pro_code: string; amount: number }[];
  price_option?: string;
  mem_route?: string;
}

const str = (v: unknown) =>
  typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';

/** คืน null = body ใช้ไม่ได้ (ไม่มีร้าน / lines ไม่ใช่ array / บรรทัดเกิน / จำนวนผิด) */
export function parseCheckoutPreviewInput(
  body: unknown,
): CheckoutPreviewInput | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const mem_code = str(b.mem_code);
  if (
    !mem_code ||
    !Array.isArray(b.lines) ||
    b.lines.length > CHECKOUT_PREVIEW_MAX_LINES
  )
    return null;
  const lines: CheckoutPreviewInput['lines'] = [];
  for (const raw of b.lines) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const pro_code = str(r.pro_code);
    const qty = Number(r.qty);
    if (!pro_code || !Number.isFinite(qty) || qty <= 0) return null;
    lines.push({ pro_code, unit: str(r.unit), qty });
  }
  const redeem: CheckoutPreviewInput['redeem'] = [];
  if (b.redeem !== undefined) {
    if (
      !Array.isArray(b.redeem) ||
      b.redeem.length > CHECKOUT_PREVIEW_MAX_LINES
    )
      return null;
    for (const raw of b.redeem) {
      if (!raw || typeof raw !== 'object') return null;
      const r = raw as Record<string, unknown>;
      const pro_code = str(r.pro_code);
      const amount = Number(r.amount);
      if (!pro_code || !Number.isInteger(amount) || amount < 1) return null;
      redeem.push({ pro_code, amount });
    }
  }
  return {
    mem_code,
    lines,
    redeem,
    price_option: str(b.price_option) || undefined,
    mem_route: str(b.mem_route) || undefined,
  };
}
