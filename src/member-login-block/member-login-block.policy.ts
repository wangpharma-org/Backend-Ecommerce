import { ForbiddenException } from '@nestjs/common';

// SSN0-273: กติกาล้วน (ไม่มี DB) ของการระงับการเข้าใช้งาน — แยกไว้ให้ unit test ได้

export const MEMBER_LOGIN_BLOCK_FLAG = 'member_login_block';

// frontend ใช้ code นี้แยก "ถูกระงับ" ออกจาก 401/403 อื่น แล้วพาไปหน้า login พร้อมเหตุผล
export const LOGIN_BLOCKED_CODE = 'LOGIN_BLOCKED';

export const REASON_MAX_LENGTH = 500;

export function loginBlockedMessage(reason: string | null): string {
  const base = 'บัญชีร้านนี้ถูกระงับการเข้าใช้งาน';
  const tail = 'กรุณาติดต่อพนักงานขาย';
  return reason ? `${base} (${reason}) ${tail}` : `${base} ${tail}`;
}

export class LoginBlockedException extends ForbiddenException {
  constructor(reason: string | null) {
    super({
      statusCode: 403,
      error: 'Forbidden',
      code: LOGIN_BLOCKED_CODE,
      message: loginBlockedMessage(reason),
      reason,
    });
  }
}

/// ตัดช่องว่างหัวท้าย + ยุบช่องว่าง/บรรทัดซ้อนให้เหลือช่องเดียว (เหตุผลไปโผล่ในกล่องข้อความหน้า login)
/// คืน null ถ้าว่าง หรือไม่ใช่ string
export function normalizeReason(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.replace(/\s+/g, ' ').trim();
  return text ? text : null;
}
