import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

const TZ = 'Asia/Bangkok';

export function getTodayRange(): { startOfDay: Date; endOfDay: Date } {
  return {
    startOfDay: dayjs().tz(TZ).startOf('day').toDate(),
    endOfDay: dayjs().tz(TZ).endOf('day').toDate(),
  };
}
