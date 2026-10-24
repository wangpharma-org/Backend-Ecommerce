export const ACTIVITY_KAFKA_CLIENT = 'ACTIVITY_KAFKA_CLIENT';

/** topic กลางของอีเวนต์กิจกรรมทุกฟีเจอร์ — ฝั่งรับคือ sale-backend (activity_events) */
export const ACTIVITY_TOPIC = 'activity_event';

/** ปิดไว้ก่อน (migration 20261024000100) เปิดเมื่อ sale-backend รับ topic แล้ว */
export const ACTIVITY_FLAG = 'activity_tracking';

/** client ส่งได้ไม่เกินเท่านี้ต่อครั้ง */
export const ACTIVITY_MAX_BATCH = 50;
