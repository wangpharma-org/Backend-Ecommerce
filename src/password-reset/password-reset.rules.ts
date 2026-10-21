import { randomInt } from 'crypto';

/** ECWC-706 ลืมรหัสผ่าน — กติกาที่ไม่แตะ DB แยกไว้ให้ทดสอบได้ */

export const PASSWORD_RESET_FEATURE_FLAG = 'password_reset_request';

/** คำขอที่ไม่มีพนักงานยืนยันภายในเวลานี้ถือว่าหมดอายุ */
export const REQUEST_TTL_HOURS = 24;
/** รหัสผ่านชั่วคราวใช้เข้าสู่ระบบได้ภายในเวลานี้หลังรีเซ็ต */
export const TEMP_PASSWORD_TTL_HOURS = 24;
/** ส่งคำขอได้ไม่เกินกี่ครั้งต่อบัญชีที่กรอก ใน 24 ชม. */
export const MAX_REQUESTS_PER_ACCOUNT_24H = 3;
/** ส่งคำขอได้ไม่เกินกี่ครั้งต่อ IP ใน 1 ชม. */
export const MAX_REQUESTS_PER_IP_1H = 10;

export type ResetRequestStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'expired';

export const REJECT_REASONS = [
  'unreachable',
  'not_requester',
  'wrong_info',
  'other',
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export const CHECKLIST_KEYS = ['called', 'ref_ok', 'info_ok'] as const;
export type Checklist = Record<(typeof CHECKLIST_KEYS)[number], boolean>;

// ไม่มีตัวที่อ่านสับสน (0/O, 1/I/l) เพราะพนักงานต้องอ่านให้ลูกค้าฟังทางโทรศัพท์
const REF_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ';
const LOWER = 'abcdefghjkmnpqrstuvwxyz';
const DIGITS = '23456789';

function pick(chars: string): string {
  return chars[randomInt(chars.length)];
}

/** รหัสอ้างอิงที่ลูกค้าต้องบอกพนักงาน เช่น PR-7K2M9QA */
export function generateRefCode(): string {
  let s = '';
  for (let i = 0; i < 7; i++) s += pick(REF_ALPHABET);
  return `PR-${s}`;
}

export function isRefCode(v: unknown): v is string {
  return typeof v === 'string' && /^PR-[A-Z0-9]{7}$/.test(v);
}

/** รหัสผ่านชั่วคราวรูปแบบ Kd7-mPq4-vT9x — มีทั้งตัวพิมพ์ใหญ่ เล็ก และตัวเลขเสมอ */
export function generateTempPassword(): string {
  const all = UPPER + LOWER + DIGITS;
  const groups = [3, 4, 4].map((n) => {
    let g = '';
    for (let i = 0; i < n; i++) g += pick(all);
    return g;
  });
  // บังคับให้มีครบทุกชนิด (ตำแหน่งสุ่ม) — กันกรณีสุ่มได้แต่ตัวอักษร
  const flat = groups.join('').split('');
  const slots = new Set<number>();
  while (slots.size < 3) slots.add(randomInt(flat.length));
  const [a, b, c] = [...slots];
  flat[a] = pick(UPPER);
  flat[b] = pick(LOWER);
  flat[c] = pick(DIGITS);
  const s = flat.join('');
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7, 11)}`;
}

/** ช่อง "รหัสสมาชิกหรือชื่อบัญชี" — ตัดช่องว่าง ไม่สนตัวพิมพ์ */
export function normalizeAccount(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  if (s.length < 1 || s.length > 60) return null;
  if (/[\s<>"'`]/.test(s)) return null;
  return s;
}

/** เบอร์มือถือ/บ้านไทย 9–10 หลัก รับขีดและช่องว่างได้ */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const d = v.replace(/[\s-]/g, '');
  return /^0\d{8,9}$/.test(d) ? d : null;
}

/** 0812349907 → 08X-XXX-9907 ตามที่ mockup แสดง */
export function maskPhone(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, '');
  if (d.length < 4) return null;
  return `${d.slice(0, 2)}X-XXX-${d.slice(-4)}`;
}

/** M0012345 → M00•••45 */
export function maskAccount(v: string | null | undefined): string | null {
  if (!v) return null;
  if (v.length <= 5) return `${v.slice(0, 1)}•••`;
  return `${v.slice(0, 3)}•••${v.slice(-2)}`;
}

export interface PasswordRuleResult {
  ok: boolean;
  min_length: boolean;
  letter_and_digit: boolean;
  /** ตัวอักษรอังกฤษ ตัวเลข สัญลักษณ์ ASCII เท่านั้น — กันพิมพ์ด้วยแป้นภาษาไทยโดยไม่รู้ตัว */
  ascii_only: boolean;
  not_temp: boolean;
}

export const PASSWORD_RULE_MESSAGE =
  'รหัสผ่านต้องยาว 8–64 ตัวอักษร มีทั้งตัวอักษรภาษาอังกฤษและตัวเลข และใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข และสัญลักษณ์ (ห้ามภาษาไทยหรือช่องว่าง)';

/** เงื่อนไขรหัสผ่านใหม่ตาม mockup หน้า 3 (`notTemp` เช็คแยกด้วย bcrypt แล้วส่งผลมา) */
export function checkNewPassword(
  password: unknown,
  notTemp = true,
): PasswordRuleResult {
  const p = typeof password === 'string' ? password : '';
  const min_length = p.length >= 8 && p.length <= 64;
  const letter_and_digit = /[A-Za-z]/.test(p) && /\d/.test(p);
  const ascii_only = /^[\x21-\x7E]*$/.test(p);
  return {
    ok: min_length && letter_and_digit && ascii_only && notTemp,
    min_length,
    letter_and_digit,
    ascii_only,
    not_temp: notTemp,
  };
}

/** checklist ต้องติ๊กครบทุกข้อ และต้องเป็น boolean true จริงๆ (ไม่รับ "true"/1) */
export function isChecklistComplete(v: unknown): v is Checklist {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return CHECKLIST_KEYS.every(
    (k) => Object.prototype.hasOwnProperty.call(o, k) && o[k] === true,
  );
}

export function isRejectReason(v: unknown): v is RejectReason {
  return (
    typeof v === 'string' && (REJECT_REASONS as readonly string[]).includes(v)
  );
}

/** สรุปอุปกรณ์จาก user-agent สั้นๆ เช่น "Chrome บน Android" */
export function describeDevice(ua: string | null | undefined): string | null {
  if (!ua) return null;
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /SamsungBrowser/.test(ua)
      ? 'Samsung Internet'
      : /Line\//.test(ua)
        ? 'LINE'
        : /Chrome\//.test(ua)
          ? 'Chrome'
          : /Firefox\//.test(ua)
            ? 'Firefox'
            : /Safari\//.test(ua)
              ? 'Safari'
              : null;
  const os = /Android/.test(ua)
    ? 'Android'
    : /iPhone|iPad|iPod/.test(ua)
      ? 'iOS'
      : /Windows/.test(ua)
        ? 'Windows'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (!browser && !os) return 'ไม่ทราบ';
  if (!os) return browser;
  if (!browser) return os;
  return `${browser} บน ${os}`;
}

export function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}
