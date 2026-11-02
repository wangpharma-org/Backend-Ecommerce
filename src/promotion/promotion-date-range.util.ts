import { BadRequestException } from '@nestjs/common';
import {
  isValidDateInput,
  toUtcEnd,
  toUtcStart,
} from 'src/utils/date.util';

/**
 * แปลงช่วงวันที่โปรเป็นเวลาที่เก็บลง DB: วันเริ่ม 00:00:00 ถึงวันสิ้นสุด 23:59:59 เวลาไทย
 * เช่น 12/10–12/10 = 12/10 00:00:00 ถึง 12/10 23:59:59 (ไทย) — ใช้ร่วมกันทุกจุดที่ตั้งวันที่โปร
 */
export function toPromotionDateRange(
  startDate: unknown,
  endDate: unknown,
): { start_date: Date; end_date: Date } {
  if (!isValidDateInput(startDate) || !isValidDateInput(endDate)) {
    throw new BadRequestException('วันที่โปรโมชั่นไม่ถูกต้อง');
  }
  const start_date = toUtcStart(startDate);
  const end_date = toUtcEnd(endDate);
  if (start_date > end_date) {
    throw new BadRequestException('วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม');
  }
  return { start_date, end_date };
}
