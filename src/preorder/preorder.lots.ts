/**
 * ตรรกะการปรับจำนวนต่อ "ล็อต" (pure function ทดสอบได้)
 * ล็อตเรียงตามเวลาเข้าคิว [0] = จองก่อนสุด
 */
export type IncreasePolicy = 'keep' | 'split' | 'reset';

export interface LotLike {
  /** undefined = ล็อตใหม่ยังไม่บันทึก */
  id?: number;
  qty: number;
  ordered_at: Date;
}

export interface ApplyAmountResult {
  lots: LotLike[];
  /** id ของล็อตเดิมที่ต้องลบ (qty เหลือ 0 หรือถูกรวม) */
  removedIds: number[];
  /** เวลาจองครั้งแรกใหม่ของรายการ (เปลี่ยนเฉพาะนโยบาย reset) */
  itemOrderedAt: Date;
  /** ข้อความสั้นสำหรับ log */
  note: string;
}

/**
 * ปรับจำนวนจาก lots ปัจจุบันเป็น newAmount
 * - ลด: ตัดจากล็อตท้ายสุดก่อน (ส่วนที่จองก่อนคงคิวไว้)
 * - เพิ่ม: keep → รวมเข้าล็อตแรก · split → ล็อตใหม่ ณ now · reset → รวมทุกล็อตเป็นล็อตเดียว ณ now
 *   ถ้ามี graceHours และยังอยู่ในช่วงผ่อนผันนับจาก firstOrderedAt → ถือเป็น keep
 */
export function applyAmountChange(
  current: LotLike[],
  newAmount: number,
  policy: IncreasePolicy,
  graceHours: number | null,
  now: Date,
): ApplyAmountResult {
  const lots = current
    .map((l) => ({ ...l }))
    .sort(
      (a, b) =>
        a.ordered_at.getTime() - b.ordered_at.getTime() ||
        (a.id ?? 0) - (b.id ?? 0),
    );
  const currentAmount = lots.reduce((s, l) => s + l.qty, 0);
  const firstOrderedAt = lots[0]?.ordered_at ?? now;
  const removedIds: number[] = [];

  if (newAmount === currentAmount) {
    return {
      lots,
      removedIds,
      itemOrderedAt: firstOrderedAt,
      note: 'ไม่เปลี่ยนจำนวน',
    };
  }

  if (newAmount < currentAmount) {
    let toCut = currentAmount - newAmount;
    for (let i = lots.length - 1; i >= 0 && toCut > 0; i--) {
      const cut = Math.min(lots[i].qty, toCut);
      lots[i].qty -= cut;
      toCut -= cut;
      if (lots[i].qty === 0) {
        if (lots[i].id !== undefined) removedIds.push(lots[i].id as number);
        lots.splice(i, 1);
      }
    }
    return {
      lots,
      removedIds,
      itemOrderedAt: lots[0]?.ordered_at ?? firstOrderedAt,
      note: `ลดจำนวน ${currentAmount} → ${newAmount} คงคิวเดิม`,
    };
  }

  const delta = newAmount - currentAmount;
  const withinGrace =
    graceHours !== null &&
    graceHours >= 0 &&
    now.getTime() - firstOrderedAt.getTime() <= graceHours * 3600 * 1000;
  const effective: IncreasePolicy = withinGrace ? 'keep' : policy;

  if (effective === 'keep') {
    if (lots.length === 0) lots.push({ qty: 0, ordered_at: now });
    lots[0].qty += delta;
    return {
      lots,
      removedIds,
      itemOrderedAt: lots[0].ordered_at,
      note: withinGrace
        ? `เพิ่ม +${delta} ภายในช่วงผ่อนผัน ${graceHours} ชม. คงคิวเดิม`
        : `เพิ่ม +${delta} คงคิวเดิม (keep)`,
    };
  }

  if (effective === 'split') {
    lots.push({ qty: delta, ordered_at: now });
    return {
      lots,
      removedIds,
      itemOrderedAt: lots[0].ordered_at,
      note: `เพิ่ม +${delta} เป็นคิวใหม่ (split)`,
    };
  }

  // reset: ทุกล็อตรวมเป็นล็อตเดียว ณ now
  for (const l of lots) if (l.id !== undefined) removedIds.push(l.id);
  return {
    lots: [{ qty: newAmount, ordered_at: now }],
    removedIds,
    itemOrderedAt: now,
    note: `เพิ่ม +${delta} ทั้งรายการย้ายไปท้ายคิว (reset)`,
  };
}

/** กระจายจำนวนที่จัดสรรได้ของรายการหนึ่งลงล็อต จากล็อตแรกก่อน */
export function distributeToLots<T extends { qty: number }>(
  lots: T[],
  allocated: number,
): number[] {
  let left = Math.max(0, allocated);
  return lots.map((l) => {
    const give = Math.min(l.qty, left);
    left -= give;
    return give;
  });
}
