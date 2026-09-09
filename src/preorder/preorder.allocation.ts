/**
 * ตัวจัดสรรของขาด (โหมด allocation) เป็น pure function เพื่อให้ทดสอบได้
 * input เรียงตามคิว (ordered_at ASC) แล้ว
 */
export type AllocationStrategy = 'fifo' | 'prorata';

export interface AllocationInput {
  id: number;
  amount: number;
}

export interface AllocationResult {
  id: number;
  amount: number;
  allocated_qty: number;
}

/**
 * fifo    : เติมให้เต็มตามคิวจนของหมด คนท้ายคิวได้ 0
 * prorata : ทุกคนได้ตามสัดส่วนที่จอง (ปัดลง) เศษที่เหลือแจกทีละ 1 ตามคิว
 */
export function computeAllocation(
  items: AllocationInput[],
  supply: number,
  strategy: AllocationStrategy,
): AllocationResult[] {
  const safeSupply = Math.max(0, Math.floor(supply));
  const totalDemand = items.reduce((s, i) => s + Math.max(0, i.amount), 0);

  if (totalDemand <= safeSupply) {
    return items.map((i) => ({
      id: i.id,
      amount: i.amount,
      allocated_qty: Math.max(0, i.amount),
    }));
  }

  if (strategy === 'fifo') {
    let remaining = safeSupply;
    return items.map((i) => {
      const give = Math.min(Math.max(0, i.amount), remaining);
      remaining -= give;
      return { id: i.id, amount: i.amount, allocated_qty: give };
    });
  }

  // prorata
  const result = items.map((i) => ({
    id: i.id,
    amount: i.amount,
    allocated_qty: Math.floor(
      (Math.max(0, i.amount) * safeSupply) / totalDemand,
    ),
  }));
  let leftover = safeSupply - result.reduce((s, r) => s + r.allocated_qty, 0);
  for (const r of result) {
    if (leftover <= 0) break;
    if (r.allocated_qty < r.amount) {
      r.allocated_qty += 1;
      leftover -= 1;
    }
  }
  return result;
}
