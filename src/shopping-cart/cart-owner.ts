import { ForbiddenException } from '@nestjs/common';

type Caller = { mem_code?: unknown } | undefined;

/**
 * ECWC-750: เส้นตะกร้าของร้าน (ใส่/ลบ/ติ๊ก/นับ) ทำกับตะกร้าของร้านใน token เท่านั้น
 *
 * เดิมใช้ mem_code ที่ client ส่งมา — ร้านหนึ่งแก้หรือดูตะกร้าร้านอื่นได้
 * ไม่มีข้อยกเว้นให้ token ที่มี permission (บัญชี Sales ก็มี) เพราะฝ่ายขายที่ทำแทนร้าน
 * ต้องผ่าน /ecom/internal/customer-cart ที่มีการขอความยินยอม (SSN0-140)
 *
 * client ยังส่ง mem_code มาได้ (เว็บและแอปส่งอยู่) แต่ต้องตรงกับ token ไม่งั้น 403
 */
export function ownCartMemCode(caller: Caller, claimed: unknown): string {
  const own =
    typeof caller?.mem_code === 'string' ? caller.mem_code.trim() : '';
  if (!own) throw new ForbiddenException('token นี้ไม่มีรหัสร้าน');
  if (claimed === undefined || claimed === null || claimed === '') return own;
  if (typeof claimed !== 'string' || claimed.trim() !== own) {
    throw new ForbiddenException('ตะกร้านี้เป็นของร้านอื่น');
  }
  return own;
}
