import { ForbiddenException } from '@nestjs/common';

type Caller = { mem_code?: unknown; permission?: unknown };

/// ผู้ดูแล (token มี permission) จัดการ session ของร้านอื่นได้ — หน้าจัดการสิทธิ์ผู้ใช้ใช้อยู่
/// ค่าใน token มาจากคอลัมน์ boolean ของ MySQL — รับทั้ง true และ 1 ไม่รับค่าอื่น
export const isSessionAdmin = (caller: Caller | undefined) =>
  caller?.permission === true || caller?.permission === 1;

/// endpoint ของ session ที่รับรหัสร้านจากผู้เรียก: ต้องเป็นร้านของ token เอง หรือเป็นผู้ดูแล
/// เดิมรับรหัสร้านอะไรก็ได้ — token ของร้านหนึ่งดูอุปกรณ์/IP ที่ login อยู่ของร้านอื่น
/// และปิด session ของร้านอื่นได้
export function assertOwnShop(
  caller: Caller | undefined,
  memCode: string,
): void {
  if (isSessionAdmin(caller)) return;
  const own = typeof caller?.mem_code === 'string' ? caller.mem_code : '';
  if (!own || own !== memCode) {
    throw new ForbiddenException('ไม่มีสิทธิ์จัดการ session ของร้านอื่น');
  }
}

/// รหัสร้านที่ใช้จำกัดคำสั่งที่อ้าง session ด้วย token — undefined = ผู้ดูแล ไม่จำกัด
export function sessionOwnerFilter(
  caller: Caller | undefined,
): string | undefined {
  if (isSessionAdmin(caller)) return undefined;
  const own = typeof caller?.mem_code === 'string' ? caller.mem_code : '';
  if (!own) throw new ForbiddenException('token นี้ไม่มีรหัสร้าน');
  return own;
}
