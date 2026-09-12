/**
 * แบ่งยอดให้ขั้นของโปรโมชั่น — กติกาเดียวกับที่ ShoppingCartService.checkPromotionReward ใช้จริง
 *
 * ทุกจุดที่บอกลูกค้าว่า "ได้ของแถมกี่ชุด" ต้องเรียกที่นี่ ไม่ใช่เช็ค progress >= threshold เอง
 * เพราะกติกาจริงมี 2 ข้อที่การเช็คตรงๆ ตกหล่น:
 *
 *   1. ขั้นเดียวได้หลายชุด — ยอด 3 เท่าของเกณฑ์ = ของแถม 3 ชุด (ECWC-496 ticket 1/3)
 *   2. ขั้นใหญ่กินยอดก่อน ที่เหลือค่อยตกไปขั้นเล็ก — ยอดที่ถูกกินไปแล้วนับซ้ำไม่ได้
 *
 * ยอดบาทกับยอดจำนวนชิ้นเป็นคนละถัง หักกันคนละทาง เหมือนใน checkPromotionReward
 */

export interface AllocatableTier {
  tier_id: number;
  /** ยอดขั้นต่ำของขั้นนี้ — บาท หรือ จำนวนชิ้น ตาม is_unit */
  threshold: number;
  is_unit: boolean;
}

export interface TierPool {
  /** ยอดบาทที่นับเข้าเงื่อนไข */
  amount: number;
  /** จำนวนหน่วยเล็กสุดที่นับเข้าเงื่อนไข */
  units: number;
}

/**
 * คืน map ของ tier_id → จำนวนชุดของแถมที่ได้จริง (0 = ยังไม่ได้)
 * ขั้นที่ยอดถึงเกณฑ์แต่โดนขั้นใหญ่กินยอดไปหมดแล้วจะได้ 0 ซึ่งตรงกับที่ engine ให้
 */
export function allocateTierSets(
  tiers: AllocatableTier[],
  pool: TierPool,
): Map<number, number> {
  const sets = new Map<number, number>(tiers.map((tier) => [tier.tier_id, 0]));

  let remainingAmount = pool.amount;
  let remainingUnits = pool.units;

  const byBiggestFirst = [...tiers].sort((a, b) => b.threshold - a.threshold);
  for (const tier of byBiggestFirst) {
    if (!tier.threshold || tier.threshold <= 0) continue;
    const available = tier.is_unit ? remainingUnits : remainingAmount;
    const multiplier = Math.floor(available / tier.threshold);
    if (multiplier <= 0) continue;

    sets.set(tier.tier_id, multiplier);
    if (tier.is_unit) remainingUnits -= multiplier * tier.threshold;
    else remainingAmount -= multiplier * tier.threshold;
  }

  return sets;
}

/** จำนวนชุดรวมทุกขั้น — ตัวเลขที่ลูกค้าเห็นว่า "ได้ของแถม N ชุด" */
export function totalTierSets(sets: Map<number, number>): number {
  let total = 0;
  for (const multiplier of sets.values()) total += multiplier;
  return total;
}
