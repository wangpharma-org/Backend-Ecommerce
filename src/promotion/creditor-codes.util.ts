import { BadRequestException } from '@nestjs/common';

/**
 * แปลง creditor_code ที่ส่งมาได้หลายรูปแบบให้เป็น array ที่ไม่ซ้ำและไม่ว่าง
 * รับได้: 'CRD001' | ['CRD001', 'CRD002'] | '["CRD001","CRD002"]' (JSON string จาก multipart/form-data)
 */
export function parseCreditorCodes(input: unknown): string[] {
  let raw = input;
  if (typeof raw === 'string' && raw.trim().startsWith('[')) {
    try {
      raw = JSON.parse(raw);
    } catch {
      throw new BadRequestException('creditor_code JSON ไม่ถูกต้อง');
    }
  }
  const codes = (Array.isArray(raw) ? raw : [raw])
    .filter((code): code is string => typeof code === 'string')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);
  return [...new Set(codes)];
}
