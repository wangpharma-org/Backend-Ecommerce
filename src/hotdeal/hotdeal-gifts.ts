// คำนวณของแถม Hot Deal จากรายการสินค้าที่ระบบภายในส่งมา (หน้า Key ขายของ sale)
// สูตรเดียวกับตะกร้าลูกค้า (HotdealService.checkHotdealMatch):
//   ชุด = floor(จำนวนซื้อรวมในหน่วยเล็กสุด ÷ จำนวนซื้อของดีลในหน่วยเล็กสุด), ของแถม = ชุด × จำนวนแถมของดีล

export const INTERNAL_HOTDEAL_GIFTS_MAX_LINES = 200;

export interface HotdealGiftLine {
  pro_code: string;
  unit: string;
  amount: number;
}

export interface HotdealGiftUnit {
  level: number;
  unit_name: string;
  ratio: number;
}

export interface HotdealGiftDeal {
  pro_code: string;
  units: HotdealGiftUnit[];
  pro1_amount: string;
  pro1_unit: string;
  gift_pro_code: string;
  gift_pro_name: string;
  gift_units: HotdealGiftUnit[];
  pro2_amount: string;
  pro2_unit: string;
}

export interface InternalHotdealGift {
  main_pro_code: string;
  pro_code: string;
  pro_name: string;
  amount: number;
  unit: string;
  sets: number;
  buy_amount: number;
  buy_unit: string;
  gift_amount: number;
}

export interface InternalHotdealGiftSkip {
  pro_code: string;
  unit: string;
  reason: 'unknown_unit' | 'invalid_deal';
}

export interface InternalHotdealGiftResult {
  gifts: InternalHotdealGift[];
  skipped: InternalHotdealGiftSkip[];
}

// รับ body ของ route — คืน null เมื่อรูปแบบผิด (controller ตอบ 400)
export function parseHotdealGiftLines(body: unknown): HotdealGiftLine[] | null {
  const items = (body as { items?: unknown } | null)?.items;
  if (
    !Array.isArray(items) ||
    items.length > INTERNAL_HOTDEAL_GIFTS_MAX_LINES
  ) {
    return null;
  }
  const lines: HotdealGiftLine[] = [];
  for (const item of items as Array<Record<string, unknown> | null>) {
    const pro_code =
      typeof item?.pro_code === 'string' ? item.pro_code.trim() : '';
    const unit = typeof item?.unit === 'string' ? item.unit.trim() : '';
    const amount = Number(item?.amount);
    if (!pro_code || !Number.isFinite(amount) || amount <= 0) return null;
    lines.push({ pro_code, unit, amount });
  }
  return lines;
}

// หน่วยของดีลเก็บเป็นระดับ '1' | '2' | '3' (แถวเก่าบางแถวเป็นชื่อหน่วย)
function dealUnit(
  stored: string,
  units: HotdealGiftUnit[],
): HotdealGiftUnit | undefined {
  const value = (stored ?? '').trim();
  return (
    units.find((u) => String(u.level) === value) ??
    units.find((u) => u.unit_name.trim() === value)
  );
}

export function computeHotdealGifts(
  lines: HotdealGiftLine[],
  deals: HotdealGiftDeal[],
): InternalHotdealGiftResult {
  const gifts: InternalHotdealGift[] = [];
  const skipped: InternalHotdealGiftSkip[] = [];

  for (const deal of deals) {
    const buyUnit = dealUnit(deal.pro1_unit, deal.units);
    const giftUnit = dealUnit(deal.pro2_unit, deal.gift_units);
    const buyAmount = Number(deal.pro1_amount);
    const giftAmount = Number(deal.pro2_amount);
    const threshold = buyAmount * (buyUnit?.ratio || 1);
    if (
      !buyUnit ||
      !giftUnit ||
      !deal.gift_pro_code ||
      !Number.isFinite(threshold) ||
      threshold <= 0 ||
      !Number.isFinite(giftAmount) ||
      giftAmount <= 0
    ) {
      skipped.push({
        pro_code: deal.pro_code,
        unit: '',
        reason: 'invalid_deal',
      });
      continue;
    }

    let total = 0;
    for (const line of lines) {
      if (line.pro_code !== deal.pro_code) continue;
      const unit = deal.units.find((u) => u.unit_name.trim() === line.unit);
      if (!unit) {
        // ไม่เดาอัตราส่วนของหน่วยที่ไม่รู้จัก — บรรทัดนี้ไม่ถูกนับ และบอกผู้เรียกไว้
        skipped.push({
          pro_code: line.pro_code,
          unit: line.unit,
          reason: 'unknown_unit',
        });
        continue;
      }
      total += line.amount * (unit.ratio || 1);
    }

    const sets = Math.floor(total / threshold);
    const amount = Math.floor(sets * giftAmount);
    if (sets < 1 || amount < 1) continue;
    gifts.push({
      main_pro_code: deal.pro_code,
      pro_code: deal.gift_pro_code,
      pro_name: deal.gift_pro_name,
      amount,
      unit: giftUnit.unit_name,
      sets,
      buy_amount: buyAmount,
      buy_unit: buyUnit.unit_name,
      gift_amount: giftAmount,
    });
  }

  return { gifts, skipped };
}
