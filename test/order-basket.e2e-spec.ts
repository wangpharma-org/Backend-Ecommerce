/**
 * E2E — ที่มาของบรรทัดออเดอร์ + snapshot กระเช้า (ECWC-525)
 *
 * ⚠️ ยิง /ecom/submit-order จริง → เขียน shopping_head/shopping_order ลง DB และยิง Slack ถ้าตั้ง SLACK_WEBHOOK_URL
 *    รันกับ server ที่ .env ไม่มี SLACK_WEBHOOK_URL เท่านั้น (เช่น worktree บน 3022) — ห้ามชี้ไป dev/prod
 *    ออเดอร์ที่สร้างจะถูกลบทิ้งตอนจบ (ต่อ DB ตรงด้วยค่าจาก .env เดียวกับ server)
 *
 * รัน:  E2E_BASE_URL=http://localhost:3022 npm run test:e2e -- order-basket
 */

export {};

import { readFileSync } from 'fs';
import * as path from 'path';
import * as mysql from 'mysql2/promise';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3022';
const API = `${BASE}/api`;
const USERNAME = process.env.E2E_USERNAME ?? 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';
const PROMO_ID = Number(process.env.E2E_PROMO_ID ?? 189);

interface ApiResult<T = unknown> {
  status: number;
  body: T;
}
interface SetView {
  set_code: string;
  set_name: string;
  price: number;
  items: Array<{ pro_code: string; qty: number }>;
  gifts: Array<{ pro_code: string; qty: number }>;
  availability: { available_sets: number };
}
interface Basket {
  basket_id: number;
  kind: 'promo' | 'set';
  lines: Array<{ spc_id: number; pro_code: string }>;
}
interface CartItem {
  pro_code: string;
  shopping_cart: Array<{ is_reward: boolean }>;
}

let token = '';
let memCode = '';
/** ราคาที่บัญชีทดสอบใช้ (A/B/C จาก token) — ส่งผิดตัว backend จะปฏิเสธว่า Total price mismatch */
let priceOption = 'C';
let db: mysql.Connection;

async function call<T = unknown>(
  method: string,
  route: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(API + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* text เปล่า */
  }
  return { status: res.status, body: parsed as T };
}

/** อ่าน DB_* จาก .env ของ repo — ไฟล์เดียวกับที่ server ใช้ ไม่มีค่าใดฝังในเทส */
function dbConfigFromEnv(): mysql.ConnectionOptions {
  const envPath = path.resolve(__dirname, '../.env');
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return {
    host: env.DB_HOST,
    port: Number(env.DB_PORT),
    user: env.DB_USERNAME,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
  };
}

async function clearCart(): Promise<void> {
  const baskets = await call<Basket[]>('GET', '/ecom/special-collection/basket');
  for (const basket of baskets.body ?? []) {
    await call('DELETE', `/ecom/special-collection/basket/${basket.basket_id}`);
  }
  const cart = await call<{ cart: CartItem[] }>(
    'GET',
    `/ecom/product-cart/${memCode}`,
  );
  const codes = new Set(
    (cart.body?.cart ?? [])
      .filter((item) => item.shopping_cart.some((sc) => !sc.is_reward))
      .map((item) => item.pro_code),
  );
  for (const pro_code of codes) {
    await call('POST', '/ecom/product-delete-cart', { mem_code: memCode, pro_code });
  }
}

async function deleteOrders(runnings: string[]): Promise<void> {
  if (runnings.length === 0) return;
  await db.query('DELETE FROM order_basket WHERE soh_running IN (?)', [runnings]);
  await db.query('DELETE FROM shopping_order WHERE soh_running IN (?)', [runnings]);
  await db.query('DELETE FROM shopping_head WHERE soh_running IN (?)', [runnings]);
}

describe('ที่มาของบรรทัดออเดอร์ (e2e, ECWC-525)', () => {
  let set: SetView;
  const created: string[] = [];

  beforeAll(async () => {
    const health = await fetch(`${API}/ecom/promotion/list`).catch(() => null);
    if (!health) throw new Error(`server ที่ ${BASE} ไม่ตอบ — ต้องรัน worktree บน 3022 ก่อน`);

    const login = await call<{ token: string }>('POST', '/ecom/login', {
      username: USERNAME,
      password: PASSWORD,
    });
    if (login.status >= 400 || !login.body?.token) {
      throw new Error(`ล็อกอินบัญชีทดสอบไม่ได้ (HTTP ${login.status}) — ดู test/README-e2e.md`);
    }
    token = login.body.token;
    const payload = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
    ) as { mem_code?: string; price_option?: string };
    memCode = String(payload.mem_code ?? '');
    priceOption = (payload.price_option ?? 'C').toUpperCase();

    db = await mysql.createConnection(dbConfigFromEnv());

    const sets = await call<SetView[]>('GET', '/ecom/bundle-set');
    expect(sets.status).toBe(200);
    const usable = (sets.body ?? []).find(
      (s) => s.availability.available_sets >= 2 && s.price > 0,
    );
    if (!usable) throw new Error('ไม่มี bundle_set ที่ active และมีสต็อกพอสำหรับทดสอบ');
    set = usable;
  }, 30_000);

  beforeEach(clearCart);

  afterAll(async () => {
    await clearCart();
    await deleteOrders(created);
    await db.end();
  });

  it('สั่งกระเช้าสำเร็จรูป 2 ชุด → บรรทัดมี set_code/basket_id, order_basket เก็บ snapshot, กระเช้าในตะกร้าหายไป', async () => {
    const made = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket/set',
      { set_code: set.set_code, qty: 2 },
    );
    expect(made.status).toBeLessThan(300);
    const basketId = made.body.basket_id;

    const summary = await call<number>('GET', '/ecom/cart/summary');
    const expectedTotal = Number(summary.body);
    expect(expectedTotal).toBeCloseTo(set.price * 2, 2);

    const submitted = await call<string[]>('POST', '/ecom/submit-order', {
      mem_code: memCode,
      total_price: expectedTotal,
      listFree: null,
      priceOption,
      paymentOptions: 'e2e',
      shippingOptions: 'e2e',
      addressed: null,
    });
    expect(submitted.status).toBeLessThan(300);
    const runnings = submitted.body;
    expect(Array.isArray(runnings) && runnings.length).toBe(1);
    created.push(...runnings);
    const running = runnings[0];

    // บรรทัดทุกบรรทัดจากกระเช้านี้ต้องมีที่มา
    const [lines] = await db.query<mysql.RowDataPacket[]>(
      'SELECT pro_code, spo_basket_id, spo_set_code, spo_total_decimal FROM shopping_order WHERE soh_running = ?',
      [running],
    );
    const expectedLineCount = set.items.length + set.gifts.length;
    expect(lines).toHaveLength(expectedLineCount);
    for (const line of lines) {
      expect(line.spo_basket_id).toBe(basketId);
      expect(line.spo_set_code).toBe(set.set_code);
    }
    const lineTotal = lines.reduce((s, l) => s + Number(l.spo_total_decimal), 0);
    expect(lineTotal).toBeCloseTo(set.price * 2, 2);

    // snapshot ของกระเช้า
    const [snap] = await db.query<mysql.RowDataPacket[]>(
      'SELECT * FROM order_basket WHERE soh_running = ?',
      [running],
    );
    expect(snap).toHaveLength(1);
    expect(snap[0].basket_id).toBe(basketId);
    expect(snap[0].kind).toBe('set');
    expect(snap[0].set_code).toBe(set.set_code);
    expect(snap[0].set_name).toBe(set.set_name);
    expect(snap[0].set_qty).toBe(2);
    expect(Number(snap[0].set_price)).toBeCloseTo(set.price, 2);
    expect(snap[0].line_count).toBe(expectedLineCount);
    expect(Number(snap[0].total_amount)).toBeCloseTo(set.price * 2, 2);

    // กระเช้าต้องไม่ค้างเป็นการ์ดว่างในตะกร้า
    const after = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    expect((after.body ?? []).some((b) => b.basket_id === basketId)).toBe(false);
    const [orphan] = await db.query<mysql.RowDataPacket[]>(
      'SELECT basket_id FROM cart_basket WHERE basket_id = ?',
      [basketId],
    );
    expect(orphan).toHaveLength(0);
  }, 60_000);

  it('สั่งกระเช้าโปร → order_basket เป็น kind promo มี promo_id ไม่มี set_code และบรรทัดของแถมไม่นับเป็นของกระเช้า', async () => {
    const board = await call<{
      tiers: Array<{ threshold: number }>;
      products: Array<{
        pro_code: string;
        pro_stock: number;
        units: Array<{ level: number; price: number }>;
      }>;
    }>('GET', `/ecom/special-collection/promo-board/${PROMO_ID}`);
    expect(board.status).toBe(200);
    const threshold = board.body.tiers[0].threshold;
    const usable = board.body.products.filter(
      (p) => p.units.length > 0 && p.units[0].price > 0 && p.pro_stock > 0,
    );
    if (usable.length < 2) throw new Error(`โปร ${PROMO_ID} มีสินค้าที่ใช้ทดสอบไม่พอ`);
    const [big, small] = usable;
    const lines = [
      {
        pro_code: big.pro_code,
        unit_level: big.units[0].level,
        qty: Math.ceil((threshold * 1.2) / big.units[0].price),
      },
      { pro_code: small.pro_code, unit_level: small.units[0].level, qty: 1 },
    ];

    const made = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines },
    );
    expect(made.status).toBeLessThan(300);
    const basketId = made.body.basket_id;

    const summary = await call<number>('GET', '/ecom/cart/summary');
    const submitted = await call<string[]>('POST', '/ecom/submit-order', {
      mem_code: memCode,
      total_price: Number(summary.body),
      listFree: null,
      priceOption,
      paymentOptions: 'e2e',
      shippingOptions: 'e2e',
      addressed: null,
    });
    expect(submitted.status).toBeLessThan(300);
    created.push(...submitted.body);
    const running = submitted.body[0];

    const [orderLines] = await db.query<mysql.RowDataPacket[]>(
      'SELECT pro_code, is_reward, spo_basket_id, spo_set_code, spo_total_decimal FROM shopping_order WHERE soh_running = ?',
      [running],
    );
    const fromBasket = orderLines.filter((l) => l.spo_basket_id === basketId);
    expect(fromBasket).toHaveLength(2);
    for (const l of fromBasket) expect(l.spo_set_code).toBeNull();
    // ของแถมจากโปร (ถ้ามี) เป็นบรรทัด is_reward ที่ไม่ผูกกับกระเช้า
    for (const l of orderLines.filter((l) => l.is_reward)) {
      expect(l.spo_basket_id).toBeNull();
    }
    const basketTotal = fromBasket.reduce((s, l) => s + Number(l.spo_total_decimal), 0);

    const [snap] = await db.query<mysql.RowDataPacket[]>(
      'SELECT * FROM order_basket WHERE soh_running = ?',
      [running],
    );
    expect(snap).toHaveLength(1);
    expect(snap[0].kind).toBe('promo');
    expect(snap[0].promo_id).toBe(PROMO_ID);
    expect(snap[0].set_code).toBeNull();
    expect(snap[0].set_qty).toBeNull();
    expect(snap[0].line_count).toBe(2);
    expect(Number(snap[0].total_amount)).toBeCloseTo(basketTotal, 2);
    expect(Number(snap[0].total_amount)).toBeGreaterThanOrEqual(threshold);

    const after = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    expect((after.body ?? []).some((b) => b.basket_id === basketId)).toBe(false);
  }, 60_000);

  it('สินค้าเดี่ยวไม่มีที่มา (คอลัมน์ใหม่เป็น NULL) และไม่มีแถว order_basket', async () => {
    const line = set.items[0];
    const added = await call('POST', '/ecom/product-add-cart', {
      mem_code: memCode,
      pro_code: line.pro_code,
      pro_unit: await smallestUnitName(line.pro_code),
      amount: 1,
    });
    expect(added.status).toBeLessThan(300);

    const summary = await call<number>('GET', '/ecom/cart/summary');
    const submitted = await call<string[]>('POST', '/ecom/submit-order', {
      mem_code: memCode,
      total_price: Number(summary.body),
      listFree: null,
      priceOption,
      paymentOptions: 'e2e',
      shippingOptions: 'e2e',
      addressed: null,
    });
    expect(submitted.status).toBeLessThan(300);
    created.push(...submitted.body);
    const running = submitted.body[0];

    const [lines] = await db.query<mysql.RowDataPacket[]>(
      'SELECT spo_basket_id, spo_set_code FROM shopping_order WHERE soh_running = ?',
      [running],
    );
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) {
      expect(l.spo_basket_id).toBeNull();
      expect(l.spo_set_code).toBeNull();
    }
    const [snap] = await db.query<mysql.RowDataPacket[]>(
      'SELECT 1 FROM order_basket WHERE soh_running = ?',
      [running],
    );
    expect(snap).toHaveLength(0);
  }, 60_000);
});

async function smallestUnitName(proCode: string): Promise<string> {
  const [rows] = await db.query<mysql.RowDataPacket[]>(
    'SELECT unit_name FROM product_unit WHERE pro_code = ? ORDER BY level ASC LIMIT 1',
    [proCode],
  );
  if (rows.length === 0) throw new Error(`สินค้า ${proCode} ไม่มีหน่วย`);
  return String(rows[0].unit_name);
}
