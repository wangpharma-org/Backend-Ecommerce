import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Bangkok';

/** รหัสร้าน — ตัวอักษร/ตัวเลข/ขีด ไม่เกิน 20 ตัว */
export const MEM_CODE_PATTERN = /^[A-Za-z0-9_-]{1,20}$/;
/** รหัสสินค้าต่อคำขอไม่เกินนี้ (Key ขายหนึ่งใบมีไม่ถึง) */
export const MAX_PRO_CODES = 200;
const PRO_CODE_PATTERN = /^[A-Za-z0-9_./-]{1,30}$/;

export type ParsedProCodes =
  | { ok: true; codes: string[] }
  | { ok: false; message: string };

/** `pro_codes=A,B,…` → รายการไม่ซ้ำ · ว่าง = [] · เกิน/รูปแบบผิด = ข้อความบอกเหตุ */
export function parseProCodes(raw: unknown): ParsedProCodes {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, codes: [] };
  }
  if (typeof raw !== 'string') {
    return { ok: false, message: 'pro_codes ต้องเป็นข้อความคั่นด้วย ,' };
  }
  const codes = [
    ...new Set(
      raw
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  ];
  if (codes.length > MAX_PRO_CODES) {
    return {
      ok: false,
      message: `pro_codes ได้ไม่เกิน ${MAX_PRO_CODES} รหัส`,
    };
  }
  const bad = codes.find((c) => !PRO_CODE_PATTERN.test(c));
  if (bad) {
    return { ok: false, message: `รหัสสินค้าไม่ถูกต้อง: ${bad}` };
  }
  return { ok: true, codes };
}

/**
 * สินค้าที่ส่งมาซึ่ง "นับยอด" ของขั้นนี้
 * - all_products: ทุกตัวที่ส่งมา ยกเว้นที่อยู่ใน promotion_tier_exclusion ของขั้นนั้น
 * - ปกติ: เฉพาะตัวที่อยู่ใน promotion_condition ของขั้นนั้น
 * เรียงตามลำดับที่ส่งมา
 */
export function matchedProCodes(
  requested: readonly string[],
  tier: { allProducts: boolean },
  conditionCodes: ReadonlySet<string>,
  excludedCodes: ReadonlySet<string>,
): string[] {
  return requested.filter((code) =>
    tier.allProducts ? !excludedCodes.has(code) : conditionCodes.has(code),
  );
}

/** วันนี้ (เวลาไทย) อยู่ในช่วง YYYY-MM-DD ทั้งสองฝั่งรวม — null = ไม่จำกัดฝั่งนั้น */
export function isDateInRange(
  today: string,
  start: string | null | undefined,
  end: string | null | undefined,
): boolean {
  const s = start ? String(start).slice(0, 10) : null;
  const e = end ? String(end).slice(0, 10) : null;
  return (!s || s <= today) && (!e || today <= e);
}

/** วันนี้เวลาไทย YYYY-MM-DD */
export function bangkokToday(now: Date = new Date()): string {
  return dayjs(now).tz(TZ).format('YYYY-MM-DD');
}

/** 'HH:mm:ss' / 'HH:mm' → 'HH:mm' */
export function hhmm(time: string | null | undefined): string {
  return String(time ?? '').slice(0, 5);
}

export interface RebateSeason {
  seasonStart: string;
  seasonEnd: string;
  /** เดือนในฤดู เรียง เม.ย. → ธ.ค. รูปแบบ YYYY-MM และเลขเดือน 1–12 */
  months: { month: string; monthNumber: number }[];
}

/**
 * ฤดู Wang Rebate: 1 เม.ย. – 31 ธ.ค. (9 เดือน) — ตรงกับ Ecommerce-Frontend src/utils/wangDaySeason.ts
 * ม.ค.–มี.ค. = ฤดูของปีก่อนที่เพิ่งจบ
 */
export function rebateSeason(now: Date = new Date()): RebateSeason {
  const local = dayjs(now).tz(TZ);
  const year = local.month() < 3 ? local.year() - 1 : local.year();
  const months = Array.from({ length: 9 }, (_, i) => {
    const monthNumber = i + 4;
    return {
      month: `${year}-${String(monthNumber).padStart(2, '0')}`,
      monthNumber,
    };
  });
  return {
    seasonStart: `${year}-04-01`,
    seasonEnd: `${year}-12-31`,
    months,
  };
}

/** ชื่อหน่วยจาก level (1/2/3) ของสินค้า · ไม่พบ = '' (ไม่คืนตัวเลขดิบ — ดู G-005) */
export function unitNameOf(
  level: string | number | null | undefined,
  units: readonly { level: number; unit_name: string }[] | undefined,
): string {
  const target = Number(level);
  return units?.find((u) => u.level === target)?.unit_name ?? '';
}

/** ค่าทศนิยมจาก MySQL (string) → number · ไม่ใช่ตัวเลข = 0 */
export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
