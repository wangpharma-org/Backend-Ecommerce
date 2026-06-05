import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Bangkok';

/** Bangkok date string 'YYYY-MM-DD' → UTC Date at Bangkok midnight */
export function toUtcStart(date: Date | string): Date {
  return dayjs.tz(date, TZ).startOf('day').toDate();
}

/** Bangkok date string 'YYYY-MM-DD' → UTC Date at Bangkok 23:59:59 */
export function toUtcEnd(date: Date | string): Date {
  return dayjs.tz(date, TZ).endOf('day').millisecond(0).toDate();
}

/** UTC Date → Bangkok date string 'YYYY-MM-DD' for display */
export function toThaiDate(date: Date): string {
  return dayjs(date).tz(TZ).format('YYYY-MM-DD');
}

/** UTC Date range covering today in Bangkok timezone */
export function getTodayRange(): { startOfDay: Date; endOfDay: Date } {
  const today = dayjs().tz(TZ);
  return {
    startOfDay: today.startOf('day').toDate(),
    endOfDay: today.endOf('day').toDate(),
  };
}
