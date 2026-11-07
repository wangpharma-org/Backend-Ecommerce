import { randomUUID } from 'crypto';

/**
 * รูปแบบอีเวนต์กิจกรรมกลาง (activity_event v1) — ใช้ร่วมกันทุกฟีเจอร์ ทุกช่องทาง
 *
 * ฝั่งรับ (sale-backend activity_events) ใช้ชื่อฟิลด์ชุดเดียวกันนี้ เพิ่มฟิลด์ใหม่ได้
 * แต่ห้ามเปลี่ยนความหมายของฟิลด์เดิม ถ้าต้องเปลี่ยนให้ขึ้น v ใหม่
 */
export const ACTIVITY_SCHEMA_VERSION = 1;

/** การกระทำ — ชุดเดียวกันทุกฟีเจอร์ เพื่อให้ dashboard ทำ funnel ได้โดยไม่ต้องรู้จักฟีเจอร์ */
export const ACTIVITY_ACTIONS = [
  'impression', // ของโผล่บนจอ (แบนเนอร์ การ์ด โปร) — นับครั้งเดียวต่อ session ต่อที่วาง
  'open', // เปิดหน้า / modal ของฟีเจอร์
  'click', // กดสิ่งที่พาไปต่อ (แบนเนอร์ ปุ่ม tier)
  'add_cart', // ใส่ตะกร้า (ฝั่ง server ส่งเอง)
  'remove_cart',
  'checkout', // เริ่มขั้นตอนสั่ง
  'order', // ออเดอร์สำเร็จ — ฝั่ง server ส่งเองเท่านั้น พร้อมมูลค่า
] as const;
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number];

/** action ที่ client ส่งเองได้ — add_cart/order ต้องมาจาก server ที่รู้ยอดจริง */
export const CLIENT_ACTIONS: ReadonlySet<ActivityAction> = new Set([
  'impression',
  'open',
  'click',
  'checkout',
]);

/** ช่องทางที่ลูกค้าหรือ sales เข้ามา */
export const ACTIVITY_CHANNELS = [
  'web', // Ecommerce-Frontend
  'app', // wangshop_app
  'shopping', // /shopping ระบบเดิม
  'sale_web', // หน้า Key ขาย ใน sale-services
  'salewang', // แอป salewang
  'unknown',
] as const;
export type ActivityChannel = (typeof ACTIVITY_CHANNELS)[number];

export interface ActivityEvent {
  v: number;
  event_id: string;
  occurred_at: string;
  received_at: string;
  /** customer = ร้านทำเอง, sales = พนักงานขายทำแทนร้าน */
  actor_type: 'customer' | 'sales';
  mem_code: string | null;
  emp_code: string | null;
  channel: ActivityChannel;
  /** ระบบที่ส่งอีเวนต์ เช่น backend-ecommerce, ecommerce-frontend */
  source: string;
  /** ฟีเจอร์ เช่น company_day, wang_day, happy_hour, bundle_set */
  feature: string;
  /** id ภายในฟีเจอร์ เช่น promo_id ของ Company Day */
  ref: string | null;
  action: ActivityAction;
  /** ตำแหน่งบนจอ เช่น home_banner, cart_modal, tier_bar */
  placement: string | null;
  pro_code: string | null;
  qty: number | null;
  /** มูลค่าบาท (มีเฉพาะ action ที่รู้ยอด เช่น order) */
  value: number | null;
  session_id: string | null;
  /** เลขเอกสาร เช่นเลขออเดอร์ 005-xxxxxx */
  doc_no: string | null;
  props: Record<string, string | number | boolean | null> | null;
}

const SLUG = /^[a-z][a-z0-9_]{0,39}$/;
const MAX_TEXT = 120;
const MAX_PROPS = 20;
/** เวลาที่ client บอกมาเชื่อได้แค่ในกรอบนี้ (นาฬิกาเครื่องลูกค้าเพี้ยนได้ / คิวค้างข้ามวัน) */
const MAX_CLIENT_SKEW_MS = 24 * 60 * 60 * 1000;

const text = (v: unknown, max = MAX_TEXT): string | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};

/** ชื่อแบบ snake_case — ยาวเกินถือว่าผิด ไม่ตัดให้ (ตัดแล้วจะกลายเป็นฟีเจอร์อื่นเงียบๆ) */
const slug = (v: unknown): string | null => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return SLUG.test(t) ? t : null;
};

const props = (
  v: unknown,
): Record<string, string | number | boolean | null> | null => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: Record<string, string | number | boolean | null> = {};
  for (const [k, raw] of Object.entries(v as Record<string, unknown>).slice(
    0,
    MAX_PROPS,
  )) {
    if (!SLUG.test(k)) continue;
    if (raw === null || typeof raw === 'boolean') out[k] = raw;
    else if (typeof raw === 'number' && Number.isFinite(raw)) out[k] = raw;
    else if (typeof raw === 'string') out[k] = raw.slice(0, MAX_TEXT);
  }
  return Object.keys(out).length ? out : null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ClientContext {
  mem_code: string;
  channel: ActivityChannel;
  source: string;
  now?: Date;
}

/**
 * แปลงอีเวนต์จาก client ให้เป็น ActivityEvent — คืน null ถ้าใช้ไม่ได้
 * ตัวตน (mem_code) มาจาก token เสมอ ไม่เชื่อค่าใน body
 */
export function normalizeClientEvent(
  raw: unknown,
  ctx: ClientContext,
): ActivityEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const action = text(r.action) as ActivityAction | null;
  if (!action || !CLIENT_ACTIONS.has(action)) return null;
  const feature = slug(r.feature);
  if (!feature) return null;

  const now = ctx.now ?? new Date();
  const clientTs =
    typeof r.occurred_at === 'string' ? Date.parse(r.occurred_at) : NaN;
  const occurred =
    Number.isFinite(clientTs) &&
    Math.abs(clientTs - now.getTime()) <= MAX_CLIENT_SKEW_MS
      ? new Date(clientTs)
      : now;
  const eventId =
    typeof r.event_id === 'string' && UUID.test(r.event_id)
      ? r.event_id.toLowerCase()
      : randomUUID();

  return {
    v: ACTIVITY_SCHEMA_VERSION,
    event_id: eventId,
    occurred_at: occurred.toISOString(),
    received_at: now.toISOString(),
    actor_type: 'customer',
    mem_code: ctx.mem_code,
    emp_code: null,
    channel: ctx.channel,
    source: ctx.source,
    feature,
    ref: text(r.ref, 64),
    action,
    placement: slug(r.placement),
    pro_code: text(r.pro_code, 30),
    qty: num(r.qty),
    value: null,
    session_id: text(r.session_id, 64),
    doc_no: null,
    props: props(r.props),
  };
}

/** แยกเว็บกับแอปจาก User-Agent — แอป Flutter ส่ง "Dart/..." */
export function channelFromUserAgent(ua: string | undefined): ActivityChannel {
  if (!ua) return 'unknown';
  if (/\bDart\//i.test(ua)) return 'app';
  if (/Mozilla\//i.test(ua)) return 'web';
  return 'unknown';
}

/** ช่องทางจาก request ของ Express (อ่าน User-Agent อย่างเดียว) */
export function channelFromRequest(req: unknown): ActivityChannel {
  const headers = (req as { headers?: Record<string, unknown> } | null)
    ?.headers;
  const ua = headers?.['user-agent'];
  return channelFromUserAgent(typeof ua === 'string' ? ua : undefined);
}

export function serverEvent(
  e: Pick<ActivityEvent, 'feature' | 'action' | 'mem_code'> &
    Partial<ActivityEvent>,
  now = new Date(),
): ActivityEvent {
  const at = now.toISOString();
  return {
    v: ACTIVITY_SCHEMA_VERSION,
    event_id: randomUUID(),
    occurred_at: at,
    received_at: at,
    actor_type: e.emp_code ? 'sales' : 'customer',
    emp_code: null,
    channel: 'unknown',
    source: 'backend-ecommerce',
    ref: null,
    placement: null,
    pro_code: null,
    qty: null,
    value: null,
    session_id: null,
    doc_no: null,
    props: null,
    ...e,
  };
}
