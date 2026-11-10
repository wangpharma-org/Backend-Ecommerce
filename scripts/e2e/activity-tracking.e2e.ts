/* eslint-disable no-console */
/**
 * E2E: อีเวนต์กิจกรรมกลาง (activity_event) — Backend-Ecommerce → Kafka → sale-backend activity_events
 *
 * ทดสอบ Company Day เป็นฟีเจอร์แรก:
 *   1. POST /ecom/activity รับเฉพาะ impression/open/click/checkout, mem_code มาจาก token, ทิ้งรายการผิด
 *   2. feature "promotion" + promo_id ถูกแปลงเป็น company_day (ตะกร้าไม่รู้ว่าโปรเป็นประเภทไหน)
 *   3. ใส่ตะกร้าสินค้าในเงื่อนไข 2 ครั้ง (ครั้งแรกยังไม่ถึงขั้น) → add_cart จากฝั่ง server ทั้ง 2 ครั้ง
 *   4. สั่งซื้อ (เฉพาะ ALLOW_ORDER=1) → order พร้อมยอดบาท + emp_code (sales ทำแทน)
 *   5. sale-backend /activity/summary + /activity/stores เห็นครบ, ไม่มีสิทธิ์ = 403
 *   6. (local) โปร/ขั้นที่ถูก soft delete ไม่ถูกนับ add_cart — สคริปต์สร้างโปรทดสอบ 3 ตัวในฐานทดสอบเอง
 *      (โปรถูกลบ, ขั้นถูกลบ, โปรควบคุมที่ต้องถูกนับ) แล้วลบทิ้งตอนจบ · ต้องมี DB_HOST(localhost)/DB_PORT/DB_USERNAME/DB_PASSWORD/DB_NAME
 *   7. (ถ้าตั้ง DEAD_BROKER_URL = e-commerce อีกตัวที่ชี้ KAFKA_ACTIVITY_BROKERS ไปที่ broker ที่ไม่ตอบ)
 *      POST /ecom/activity 50 รายการต้องตอบเร็ว (ไม่รอ Kafka) และหลังส่งพลาดติดกันต้องพักส่ง
 *
 * ใช้ (local — สคริปต์เซ็น token เองจาก ACCESS_TOKEN_SECRET / SALE_JWT_SECRET):
 *   BASE_URL=http://localhost:3051/api SALE_URL=http://localhost:3052/api/sale \
 *   PROMO_ID=39 PRO_CODE=E2E-P01 PRO_UNIT=กล่อง MEM_CODE=E2E-C01 ALLOW_ORDER=1 E2E_ENABLE_FLAG=1 \
 *   npx ts-node scripts/e2e/activity-tracking.e2e.ts
 * ใช้ (deployed): ตั้ง E2E_ENV=dev|staging|prod + USER_TOKEN (ร้านทดสอบ) + SALE_TOKEN (มี SALE_ACTIVITY:READ)
 *   + ADMIN_TOKEN (role Admin หรือเมนู feature-flag) ถ้าต้องให้สคริปต์เปิด flag เอง
 *   ห้ามตั้ง ALLOW_ORDER บน prod เว้นแต่ตกลงร้าน/ออเดอร์ทดสอบไว้แล้ว — ออเดอร์จริงไหลต่อไปคลัง
 *
 * ข้อมูลทดสอบ: session_id ของทุกอีเวนต์จาก client ขึ้นต้น "E2E <env>" · ออเดอร์ทดสอบ (local) ลบโดยสคริปต์ที่เรียก
 * flag activity_tracking: ถ้าปิดอยู่และ E2E_ENABLE_FLAG=1 สคริปต์เปิดให้แล้วคืนค่าเดิมตอนจบ
 * ผลลัพธ์: docs/e2e/activity-tracking-<env>-<timestamp>.md
 */
import { JwtService } from '@nestjs/jwt';
import { execSync } from 'child_process';
import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { createConnection } from 'mysql2/promise';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/$/, '');
const SALE_URL = (process.env.SALE_URL ?? '').replace(/\/$/, '');
const PROMO_ID = Number(process.env.PROMO_ID ?? 0);
const PRO_CODE = process.env.PRO_CODE ?? '';
const PRO_UNIT = process.env.PRO_UNIT ?? '';
const MEM_CODE = process.env.MEM_CODE ?? '';
const QTY = Number(process.env.QTY ?? 30);
const EMP_CODE = process.env.EMP_CODE ?? 'E2E-EMP';
const ALLOW_ORDER = process.env.ALLOW_ORDER === '1';
const ENABLE_FLAG = process.env.E2E_ENABLE_FLAG === '1';
const DEAD_BROKER_URL = (process.env.DEAD_BROKER_URL ?? '').replace(/\/$/, '');
/** POST /ecom/activity ต้องตอบภายในเท่านี้แม้ broker ไม่ตอบ */
const FAST_MS = 2000;
const isLocal = (u: string) =>
  /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(u);
const IS_LOCAL = isLocal(BASE_URL) && isLocal(SALE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const UA = 'Mozilla/5.0 (E2E activity-tracking)';
const TAG = `E2E ${E2E_ENV} ${new Date().toISOString().slice(0, 19)}`;
const GIT_SHA = (() => {
  try {
    return execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
  } catch {
    return 'unknown';
  }
})();

function fail(msg: string): never {
  console.error(msg);
  process.exit(2);
}
if (!BASE_URL || !SALE_URL || !PROMO_ID || !PRO_CODE || !MEM_CODE) {
  fail('ต้องตั้ง BASE_URL, SALE_URL, PROMO_ID, PRO_CODE, MEM_CODE');
}
if (!E2E_ENV)
  fail('BASE_URL/SALE_URL ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|staging|prod');
if (E2E_ENV === 'local' && !IS_LOCAL)
  fail('E2E_ENV=local แต่ URL ไม่ใช่ localhost');
if (DEAD_BROKER_URL && IS_LOCAL && !isLocal(DEAD_BROKER_URL))
  fail('DEAD_BROKER_URL ต้องเป็น localhost เมื่อรัน local');

interface Res {
  status: number;
  body: unknown;
}
async function call(
  base: string,
  method: string,
  path: string,
  token: string | null,
  body?: unknown,
): Promise<Res> {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': UA,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // ไม่ใช่ JSON
  }
  return { status: res.status, body: parsed };
}

interface Step {
  name: string;
  ok: boolean;
  detail: string;
}
const steps: Step[] = [];
function check(name: string, ok: boolean, detail: string) {
  steps.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
}
const rec = (v: unknown) =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};

async function tokens(): Promise<{
  user: string;
  admin: string;
  sale: string;
  saleNoPerm: string;
}> {
  if (E2E_ENV !== 'local') {
    const user = process.env.USER_TOKEN ?? '';
    const sale = process.env.SALE_TOKEN ?? '';
    if (!user || !sale) fail('deployed ต้องตั้ง USER_TOKEN และ SALE_TOKEN');
    return {
      user,
      admin: process.env.ADMIN_TOKEN ?? user,
      sale,
      saleNoPerm: process.env.SALE_TOKEN_NOPERM ?? '',
    };
  }
  const ecomSecret = process.env.ACCESS_TOKEN_SECRET;
  const saleSecret = process.env.SALE_JWT_SECRET;
  if (!ecomSecret || !saleSecret)
    fail('local ต้องมี ACCESS_TOKEN_SECRET และ SALE_JWT_SECRET ใน env');
  const ecom = new JwtService({ secret: ecomSecret });
  const sale = new JwtService({ secret: saleSecret });
  return {
    user: await ecom.signAsync(
      {
        mem_code: MEM_CODE,
        username: MEM_CODE,
        name: TAG,
        price_option: 'C',
        mem_route: '',
        permission: true,
        role: 'User',
      },
      { expiresIn: '20m' },
    ),
    // เปิด/ปิด flag ได้เฉพาะ Admin หรือเมนู feature-flag (ECWC-749)
    admin: await ecom.signAsync(
      {
        mem_code: 'E2E-ADMIN',
        username: 'E2E-ADMIN',
        name: TAG,
        role: 'Admin',
        permission: true,
      },
      { expiresIn: '20m' },
    ),
    sale: await sale.signAsync(
      {
        sub: 'e2e-local-activity',
        email: 'e2e-local@example.com',
        name: TAG,
        permissions: ['SALE_ACTIVITY:READ'],
      },
      { expiresIn: '20m' },
    ),
    saleNoPerm: await sale.signAsync(
      {
        sub: 'e2e-local-noperm',
        email: 'e2e-noperm@example.com',
        name: TAG,
        permissions: ['SALE_TICKET:READ'],
      },
      { expiresIn: '20m' },
    ),
  };
}

const bkkDate = (d = new Date()) =>
  new Date(d.getTime() + 7 * 3600e3).toISOString().slice(0, 10);

/**
 * โปรทดสอบในฐาน local สำหรับเช็ค soft delete — ทุกตัวมีสินค้า PRO_CODE ในเงื่อนไข เปิดอยู่ และอยู่ในช่วงวันที่
 *   deletedPromo: promotion.deleted_at ถูกตั้ง · deletedTier: โปรยังอยู่แต่ขั้นเดียวถูกลบ · control: ต้องถูกนับ
 *   (control พิสูจน์ว่า server เห็นโปรที่เพิ่งสร้างจริง ไม่ใช่ผ่านเพราะ cache เก่า)
 */
interface SoftDeleteFixture {
  deletedPromo: number;
  deletedTier: number;
  control: number;
  retireControl(): Promise<void>;
  cleanup(): Promise<string>;
}
async function softDeleteFixture(): Promise<SoftDeleteFixture | null> {
  const host = process.env.DB_HOST ?? '';
  if (E2E_ENV !== 'local' || !/^(localhost|127\.0\.0\.1)$/.test(host)) {
    return null;
  }
  const db = await createConnection({
    host,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z',
  });
  const [src] = await db.query<RowDataPacket[]>(
    'SELECT creditor_code FROM promotion WHERE promo_id = ?',
    [PROMO_ID],
  );
  const creditor = (src[0]?.creditor_code as string | null) ?? null;
  const now = Date.now();
  const from = new Date(now - 24 * 3600e3);
  const to = new Date(now + 24 * 3600e3);
  const ids: number[] = [];
  const make = async (label: string, deleted: 'promo' | 'tier' | null) => {
    const [p] = await db.query<ResultSetHeader>(
      `INSERT INTO promotion (promo_name, start_date, end_date, status, creditor_code, deleted_at)
       VALUES (?, ?, ?, 1, ?, ?)`,
      [
        `${TAG} ${label}`,
        from,
        to,
        creditor,
        deleted === 'promo' ? new Date() : null,
      ],
    );
    ids.push(p.insertId);
    const [t] = await db.query<ResultSetHeader>(
      `INSERT INTO promotion_tier (tier_name, min_amount, all_products, is_unit, promo_id, deleted_at)
       VALUES (?, 999999, 0, 0, ?, ?)`,
      [`${TAG} tier`, p.insertId, deleted === 'tier' ? new Date() : null],
    );
    await db.query(
      'INSERT INTO promotion_condition (product_code, tier_id) VALUES (?, ?)',
      [PRO_CODE, t.insertId],
    );
    return p.insertId;
  };
  const deletedPromo = await make('soft-deleted promo', 'promo');
  const deletedTier = await make('soft-deleted tier', 'tier');
  const control = await make('control (live)', null);
  return {
    deletedPromo,
    deletedTier,
    control,
    // ปิดโปรควบคุมก่อนสั่งซื้อ ไม่ให้ไปปนกับการคำนวณโปรของออเดอร์
    retireControl: async () => {
      await db.query(
        'UPDATE promotion SET status = 0, deleted_at = NOW(6) WHERE promo_id = ?',
        [control],
      );
    },
    cleanup: async () => {
      try {
        await db.query(
          `DELETE c FROM promotion_condition c JOIN promotion_tier t ON t.tier_id = c.tier_id
            WHERE t.promo_id IN (?)`,
          [ids],
        );
        await db.query('DELETE FROM promotion_tier WHERE promo_id IN (?)', [
          ids,
        ]);
        await db.query('DELETE FROM promotion WHERE promo_id IN (?)', [ids]);
        return `ลบโปรทดสอบ ${ids.join(',')} แล้ว`;
      } catch (error) {
        // ถ้ามีแถวอื่นอ้างถึง ให้เหลือไว้แบบปิดและ soft delete
        await db.query(
          'UPDATE promotion SET status = 0, deleted_at = COALESCE(deleted_at, NOW(6)) WHERE promo_id IN (?)',
          [ids],
        );
        return `ลบไม่ได้ (${String(error)}) — ปิด+soft delete ${ids.join(',')} ไว้แทน`;
      } finally {
        await db.end();
      }
    },
  };
}

/** สร้างชุดอีเวนต์ click 50 รายการ (เต็ม ACTIVITY_MAX_BATCH) */
const fullBatch = (session: string) =>
  Array.from({ length: 50 }, () => ({
    event_id: randomUUID(),
    session_id: session,
    occurred_at: new Date().toISOString(),
    action: 'click',
    feature: 'company_day',
    ref: PROMO_ID,
    placement: 'e2e_dead_broker',
  }));

async function main() {
  const t = await tokens();
  const session = `${TAG} ${randomUUID().slice(0, 8)}`;
  const startedAt = new Date();

  // --- flag
  const flagRes = await call(
    BASE_URL,
    'GET',
    '/ecom/feature-flag/activity_tracking',
    null,
  );
  const flagWasOn = flagRes.body === true;
  let flagChanged = false;
  if (!flagWasOn) {
    if (!ENABLE_FLAG)
      fail(
        'flag activity_tracking ปิดอยู่ — ตั้ง E2E_ENABLE_FLAG=1 หรือให้แอดมินเปิดก่อน',
      );
    const up = await call(
      BASE_URL,
      'POST',
      '/ecom/feature-flag/update-flag',
      t.admin,
      { flag: 'activity_tracking', status: true },
    );
    flagChanged = up.status < 300;
    check('เปิด flag activity_tracking', flagChanged, `HTTP ${up.status}`);
  } else {
    check('flag activity_tracking เปิดอยู่แล้ว', true, 'ไม่ต้องแตะ');
  }

  let fixture: SoftDeleteFixture | null = null;
  try {
    fixture = await softDeleteFixture();
    check(
      'เตรียมโปรทดสอบ soft delete',
      true,
      fixture
        ? `ลบทั้งโปร #${fixture.deletedPromo} · ลบขั้น #${fixture.deletedTier} · ควบคุม #${fixture.control}`
        : 'ข้าม (ไม่ใช่ local หรือไม่มี DB_* ของฐานทดสอบ)',
    );

    // --- 1. guard + validation
    const noAuth = await call(BASE_URL, 'POST', '/ecom/activity', null, {
      events: [],
    });
    check(
      'ไม่มี token → ถูกปฏิเสธ',
      noAuth.status === 401 || noAuth.status === 403,
      `HTTP ${noAuth.status}`,
    );

    const tooMany = await call(BASE_URL, 'POST', '/ecom/activity', t.user, {
      events: Array.from({ length: 51 }, () => ({
        action: 'click',
        feature: 'company_day',
      })),
    });
    check(
      'เกิน 50 รายการ → 400',
      tooMany.status === 400,
      `HTTP ${tooMany.status}`,
    );

    const ev = (o: Record<string, unknown>) => ({
      event_id: randomUUID(),
      session_id: session,
      occurred_at: new Date().toISOString(),
      ...o,
    });
    const batch = await call(BASE_URL, 'POST', '/ecom/activity', t.user, {
      events: [
        ev({
          action: 'impression',
          feature: 'company_day',
          ref: PROMO_ID,
          placement: 'home_banner',
          mem_code: 'SOMEONE_ELSE',
        }),
        ev({
          action: 'open',
          feature: 'promotion',
          ref: PROMO_ID,
          placement: 'cart_recommend',
        }),
        ev({
          action: 'click',
          feature: 'company_day',
          ref: PROMO_ID,
          placement: 'home_banner',
        }),
        ev({ action: 'add_cart', feature: 'company_day', ref: PROMO_ID }),
        ev({ action: 'click', feature: 'Bad Feature', ref: PROMO_ID }),
        ev({ action: 'open', feature: 'promotion', ref: 999999999 }),
      ],
    });
    const b = rec(batch.body);
    check(
      'ส่งชุดอีเวนต์: รับ 3 ทิ้ง 3 (add_cart จาก client / ชื่อฟีเจอร์ผิด / โปรไม่มีจริง)',
      batch.status === 200 &&
        b.enabled === true &&
        b.accepted === 3 &&
        b.dropped === 3,
      `HTTP ${batch.status} ${JSON.stringify(b)}`,
    );

    // --- 2. add_cart (server) — ครั้งแรก 1 ชิ้น ยอดยังไม่ถึงขั้นไหน ก็ต้องนับ
    const first = await call(
      BASE_URL,
      'POST',
      '/ecom/product-add-cart',
      t.user,
      {
        mem_code: MEM_CODE,
        pro_code: PRO_CODE,
        pro_unit: PRO_UNIT,
        amount: 1,
        company_day_source: 'Product List',
      },
    );
    check(
      'ใส่ตะกร้า 1 ชิ้น (ยังไม่ถึงขั้น)',
      first.status < 300,
      `HTTP ${first.status}`,
    );
    const add = await call(BASE_URL, 'POST', '/ecom/product-add-cart', t.user, {
      mem_code: MEM_CODE,
      pro_code: PRO_CODE,
      pro_unit: PRO_UNIT,
      amount: QTY,
      company_day_source: 'Product List',
    });
    check(
      `ใส่ตะกร้าจนครบ ${QTY} ชิ้น (ถึงขั้น)`,
      add.status < 300,
      `HTTP ${add.status}`,
    );

    if (fixture) await fixture.retireControl();

    // --- 3. order (server)
    let running: string[] = [];
    if (ALLOW_ORDER) {
      const order = await call(BASE_URL, 'POST', '/ecom/submit-order', t.user, {
        mem_code: MEM_CODE,
        priceOption: 'C',
        emp_code: EMP_CODE,
        listFree: null,
        paymentOptions: 'wang-credit',
        shippingOptions: 'wang',
        addressed: null,
      });
      running = Array.isArray(order.body) ? (order.body as string[]) : [];
      check(
        'สั่งซื้อ (sales ทำแทน emp_code)',
        order.status < 300 && running.length > 0,
        `HTTP ${order.status} ${running.join(',')}`,
      );
    } else {
      check('ข้ามการสั่งซื้อ', true, 'ALLOW_ORDER ไม่ได้ตั้ง');
    }

    // --- 4. sale-backend
    const q = `feature=company_day&ref=${PROMO_ID}&dateFrom=${bkkDate(startedAt)}&dateTo=${bkkDate()}`;
    const want = [
      'impression',
      'open',
      'click',
      'add_cart',
      ...(ALLOW_ORDER ? ['order'] : []),
    ];
    let summary: Record<string, unknown> = {};
    let store: Record<string, unknown> | undefined;
    for (let i = 0; i < 30; i++) {
      const s = await call(SALE_URL, 'GET', `/activity/summary?${q}`, t.sale);
      summary = rec(s.body);
      const st = await call(
        SALE_URL,
        'GET',
        `/activity/stores?${q}&limit=2000`,
        t.sale,
      );
      store = (Array.isArray(st.body) ? st.body : [])
        .map(rec)
        .find((r) => r.memCode === MEM_CODE);
      const funnel = (Array.isArray(summary.funnel) ? summary.funnel : []).map(
        rec,
      );
      const have = funnel
        .filter((f) => Number(f.stores) > 0)
        .map((f) => String(f.action));
      if (want.every((a) => have.includes(a)) && store) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    const funnel = (Array.isArray(summary.funnel) ? summary.funnel : []).map(
      rec,
    );
    const have = funnel
      .filter((f) => Number(f.stores) > 0)
      .map((f) => String(f.action));
    check(
      'sale-backend summary เห็นทุกขั้น',
      want.every((a) => have.includes(a)),
      `มี ${have.join(',')} (ต้องการ ${want.join(',')})`,
    );
    check(
      'ร้านทดสอบอยู่ในรายชื่อร้าน ขั้นลึกสุดถูก',
      !!store && store.stage === (ALLOW_ORDER ? 'order' : 'add_cart'),
      JSON.stringify(store ?? null),
    );
    check(
      'add_cart ครบ 2 ครั้ง รวมครั้งที่ยังไม่ถึงขั้น',
      !!store && store.addCarts === 2,
      `addCarts=${String(store?.addCarts)}`,
    );
    check(
      'channel = web (จาก User-Agent)',
      !!store &&
        Array.isArray(store.channels) &&
        (store.channels as string[]).includes('web'),
      JSON.stringify(store?.channels),
    );
    if (ALLOW_ORDER) {
      check(
        'ยอดบาทของออเดอร์ > 0',
        !!store && Number(store.value) > 0,
        `value=${String(store?.value)}`,
      );
      check(
        'emp_code ของ sales ติดมากับออเดอร์',
        !!store &&
          Array.isArray(store.empCodes) &&
          (store.empCodes as string[]).includes(EMP_CODE),
        JSON.stringify(store?.empCodes),
      );
      const byCh = (
        Array.isArray(summary.byChannel) ? summary.byChannel : []
      ).map(rec);
      check(
        'summary แยก actorType=sales ของ order',
        byCh.some((c) => c.action === 'order' && c.actorType === 'sales'),
        JSON.stringify(byCh.filter((c) => c.action === 'order')),
      );
    }
    if (fixture) {
      const storesFor = async (promoId: number) => {
        const r = await call(
          SALE_URL,
          'GET',
          `/activity/stores?feature=company_day&ref=${promoId}&dateFrom=${bkkDate(startedAt)}&dateTo=${bkkDate()}&limit=2000`,
          t.sale,
        );
        return (Array.isArray(r.body) ? r.body : [])
          .map(rec)
          .find((x) => x.memCode === MEM_CODE);
      };
      let control: Record<string, unknown> | undefined;
      for (let i = 0; i < 15 && !control; i++) {
        control = await storesFor(fixture.control);
        if (!control) await new Promise((r) => setTimeout(r, 1000));
      }
      check(
        'โปรควบคุม (ไม่ถูกลบ) ถูกนับ add_cart — server เห็นโปรทดสอบจริง',
        !!control && Number(control.addCarts) >= 1,
        `addCarts=${String(control?.addCarts)}`,
      );
      const delPromo = await storesFor(fixture.deletedPromo);
      check(
        'โปรที่ถูก soft delete ไม่ถูกนับ add_cart',
        !delPromo,
        delPromo ? JSON.stringify(delPromo) : 'ไม่มีอีเวนต์',
      );
      const delTier = await storesFor(fixture.deletedTier);
      check(
        'โปรที่ขั้นถูก soft delete ไม่ถูกนับ add_cart',
        !delTier,
        delTier ? JSON.stringify(delTier) : 'ไม่มีอีเวนต์',
      );
    }

    if (t.saleNoPerm) {
      const np = await call(
        SALE_URL,
        'GET',
        `/activity/summary?${q}`,
        t.saleNoPerm,
      );
      check(
        'ไม่มีสิทธิ์ SALE_ACTIVITY:READ → 403',
        np.status === 403,
        `HTTP ${np.status}`,
      );
    }
    const bad = await call(
      SALE_URL,
      'GET',
      `/activity/summary?feature=Company%20Day&dateFrom=${bkkDate()}&dateTo=${bkkDate()}`,
      t.sale,
    );
    check('query ผิดรูปแบบ → 400', bad.status === 400, `HTTP ${bad.status}`);

    // --- 7. broker ไม่ตอบ: request ต้องไม่ค้าง + พักส่งหลังพลาดติดกัน
    if (DEAD_BROKER_URL) {
      const timed = async () => {
        const t0 = Date.now();
        const r = await call(
          DEAD_BROKER_URL,
          'POST',
          '/ecom/activity',
          t.user,
          {
            events: fullBatch(`${session} dead-broker`),
          },
        );
        return { ms: Date.now() - t0, r, b: rec(r.body) };
      };
      const runs = [await timed(), await timed(), await timed()];
      check(
        `broker ไม่ตอบ: POST 50 รายการ 3 ครั้ง ตอบภายใน ${FAST_MS}ms ทุกครั้ง`,
        runs.every((x) => x.r.status === 200 && x.ms < FAST_MS),
        runs
          .map(
            (x) =>
              `HTTP ${x.r.status} ${x.ms}ms accepted=${String(x.b.accepted)}`,
          )
          .join(' · '),
      );
      // 3 ชุดที่ส่งเบื้องหลังหมดเวลา (5 วินาที) → พักส่ง ชุดต่อไปต้องถูกทิ้งทันที
      await new Promise((r) => setTimeout(r, 7000));
      const paused = await timed();
      check(
        'broker ไม่ตอบ: หลังพลาด 3 ชุดติดกัน พักส่ง (accepted=0) และยังตอบเร็ว',
        paused.r.status === 200 &&
          paused.ms < FAST_MS &&
          paused.b.accepted === 0,
        `HTTP ${paused.r.status} ${paused.ms}ms ${JSON.stringify(paused.b)}`,
      );
    } else {
      check('ข้ามเคส broker ไม่ตอบ', true, 'DEAD_BROKER_URL ไม่ได้ตั้ง');
    }
  } finally {
    if (fixture) {
      const msg = await fixture.cleanup();
      check('ลบโปรทดสอบ soft delete', !msg.startsWith('ลบไม่ได้'), msg);
    }
    if (flagChanged) {
      const back = await call(
        BASE_URL,
        'POST',
        '/ecom/feature-flag/update-flag',
        t.admin,
        { flag: 'activity_tracking', status: false },
      );
      check(
        'คืนค่า flag activity_tracking = ปิด',
        back.status < 300,
        `HTTP ${back.status}`,
      );
    }
  }

  const passed = steps.filter((s) => s.ok).length;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `activity-tracking-${E2E_ENV}-${stamp}.md`);
  writeFileSync(
    file,
    [
      `# E2E activity-tracking — ${E2E_ENV}`,
      '',
      `- environment: **${E2E_ENV}**`,
      `- commit: Backend-Ecommerce \`${GIT_SHA}\` · sale-backend \`${process.env.SALE_COMMIT ?? 'ไม่ระบุ'}\``,
      `- เวลา: ${startedAt.toISOString()}`,
      `- e-commerce: ${BASE_URL} · sale-backend: ${SALE_URL}${DEAD_BROKER_URL ? ` · e-commerce (broker ไม่ตอบ): ${DEAD_BROKER_URL}` : ''}`,
      `- โปร: ${PROMO_ID} · สินค้า ${PRO_CODE} × ${QTY} · ร้าน ${MEM_CODE} · สั่งซื้อ: ${ALLOW_ORDER ? 'ใช่' : 'ไม่'}`,
      `- tag ข้อมูลทดสอบ: session_id ขึ้นต้น \`${TAG}\``,
      `- ผล: **${passed}/${steps.length}**`,
      '',
      '| # | ขั้น | ผล | รายละเอียด |',
      '|---|---|---|---|',
      ...steps.map(
        (s, i) =>
          `| ${i + 1} | ${s.name} | ${s.ok ? 'PASS' : 'FAIL'} | ${s.detail.replace(/\|/g, '\\|').slice(0, 300)} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`\n${passed}/${steps.length} passed → ${file}`);
  process.exit(passed === steps.length ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
