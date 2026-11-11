import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Bangkok';
const HAS_UTC_OFFSET = /(Z|[+-]\d{2}:?\d{2})$/i;

// string ที่มี Z/offset คือเวลาจริงอยู่แล้ว — dayjs.tz(string) จะตัด offset ทิ้งแล้วอ่านเป็นเวลาไทย
// ทำให้ '2026-10-11T17:00:00Z' (เที่ยงคืน 12/10 ไทย) กลายเป็นวันที่ 11 จึงต้องแปลงเป็นเวลาไทยก่อน
function toBangkok(date: Date | string): dayjs.Dayjs {
  if (typeof date === 'string' && !HAS_UTC_OFFSET.test(date)) {
    return dayjs.tz(date, TZ);
  }
  return dayjs(date).tz(TZ);
}

/** true เมื่อแปลงเป็นวันที่ได้ — dayjs.tz โยน RangeError ถ้าเจอค่าที่ไม่ใช่วันที่ จึงต้องเช็คก่อน */
export function isValidDateInput(date: unknown): date is Date | string {
  return (
    (typeof date === 'string' || date instanceof Date) && dayjs(date).isValid()
  );
}

/** Bangkok date 'YYYY-MM-DD' (หรือ ISO ที่มี offset / Date) → UTC Date at Bangkok 00:00:00 */
export function toUtcStart(date: Date | string): Date {
  return toBangkok(date).startOf('day').toDate();
}

/** Bangkok date 'YYYY-MM-DD' (หรือ ISO ที่มี offset / Date) → UTC Date at Bangkok 23:59:59 */
export function toUtcEnd(date: Date | string): Date {
  return toBangkok(date).endOf('day').millisecond(0).toDate();
}

/** UTC Date → Bangkok date string 'YYYY-MM-DD' for display */
export function toThaiDate(date: Date): string {
  return dayjs(date).tz(TZ).format('YYYY-MM-DD');
}

/** UTC Date → Bangkok date-time string 'DD/MM/YYYY HH:mm' for reports */
export function toThaiDateTime(date: Date): string {
  return dayjs(date).tz(TZ).format('DD/MM/YYYY HH:mm');
}

/** UTC Date range covering today in Bangkok timezone */
export function getTodayRange(): { startOfDay: Date; endOfDay: Date } {
  const today = dayjs().tz(TZ);
  return {
    startOfDay: today.startOf('day').toDate(),
    endOfDay: today.endOf('day').toDate(),
  };
}
