export type TierProductUsage = {
  pro_code: string;
  tier_name: string;
};

export type BuyGiftConflict = {
  pro_code: string;
  condition_tier: string;
  reward_tier: string;
};

/**
 * หาสินค้าที่เป็นทั้ง "สินค้าเข้าร่วมรายการ" และ "ของแถม" ในโปรเดียวกัน (ข้ามทุก tier)
 * ใช้ตอน duplicate โปร — โปรเก่าที่ตั้งไว้ก่อนมีกฎนี้อาจมีข้อมูลผิดกฎติดมา
 */
export function findBuyGiftConflicts(
  conditions: TierProductUsage[],
  rewards: TierProductUsage[],
): BuyGiftConflict[] {
  const conflicts: BuyGiftConflict[] = [];
  const seen = new Set<string>();
  for (const cond of conditions) {
    for (const reward of rewards) {
      if (reward.pro_code !== cond.pro_code) continue;
      const key = `${cond.pro_code}|${cond.tier_name}|${reward.tier_name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        pro_code: cond.pro_code,
        condition_tier: cond.tier_name,
        reward_tier: reward.tier_name,
      });
    }
  }
  return conflicts;
}

export function formatBuyGiftConflicts(conflicts: BuyGiftConflict[]): string {
  return conflicts
    .map(
      (c) =>
        `${c.pro_code} (สินค้าเข้าร่วมรายการใน ${c.condition_tier} / ของแถมใน ${c.reward_tier})`,
    )
    .join(', ');
}
