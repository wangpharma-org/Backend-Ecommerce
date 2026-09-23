/**
 * E2E — flashsale ในคอลเลกชันพิเศษ (ECWC-523)
 *
 * ยิง HTTP ใส่ backend ที่รันอยู่จริง เหมือน promo-basket.e2e-spec.ts
 * เทสสร้าง flashsale + คอลเลกชันของตัวเองผ่าน API แล้วลบทิ้งตอนจบ
 *
 * รัน:  npm run test:e2e -- flashsale-collection
 */

// ทำให้ไฟล์เป็น module — ไม่งั้น const ระดับบนชนกับ spec อื่นตอน type-check
export {};

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3021';
const API = `${BASE}/api`;
const USERNAME = process.env.E2E_USERNAME ?? 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';
const TAG = `E2E-523-${Date.now()}`;
const PROMO_ID = Number(process.env.E2E_PROMO_ID ?? 189);

interface ApiResult<T = unknown> {
  status: number;
  body: T;
}
interface FlashsaleRow {
  promotion_id: number;
  promotion_name: string;
}
interface FlashsalePayload {
  promotion_id: number;
  promotion_name: string;
  date: string;
  time_start: string;
  time_end: string;
  product_count: number;
  live: boolean;
}
interface ResolvedItem {
  item_id: number;
  ref_type: string;
  ref_id: string;
  payload: FlashsalePayload | null;
  unavailable: boolean;
  display_name: string | null;
}
interface MyCollections {
  collections: Array<{ collection_id: number; items: ResolvedItem[] }>;
}
interface FlashsaleDetail {
  promotion_id: number;
  live: boolean;
  flashsaleProducts: Array<{
    limit: number | null;
    product: {
      pro_code: string;
      pro_priceA: string;
      pro_stock: number;
      units: Array<{ unit_name: string; level: number; ratio: number }>;
      inCarts: Array<{ spc_amount: string; spc_unit: string }>;
    };
  }>;
}
interface CartItem {
  pro_code: string;
  shopping_cart: Array<{ is_reward: boolean }>;
}

let token = '';
let memCode = '';

async function call<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  const res = await fetch(API + path, {
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
    /* บาง endpoint คืน text/number เปล่า */
  }
  return { status: res.status, body: parsed as T };
}

/** HH:mm:ss ของเวลาที่เลื่อนจากตอนนี้ไป n นาที (ตาม TZ เครื่องเดียวกับ server) */
const clockPlus = (minutes: number): string => {
  const d = new Date(Date.now() + minutes * 60_000);
  return d.toTimeString().split(' ')[0];
};
const today = (): string => new Date().toLocaleDateString('sv-SE');
const yesterday = (): string =>
  new Date(Date.now() - 86_400_000).toLocaleDateString('sv-SE');

/** สร้าง flashsale ผ่าน API แอดมิน แล้วหา id จาก list เพราะ add ไม่คืน id กลับมาแบบแน่นอน */
async function createFlashsale(input: {
  name: string;
  date: string;
  time_start: string;
  time_end: string;
}): Promise<number> {
  const created = await call('POST', '/ecom/daily-flashsale/add-flashsale', {
    promotion_name: input.name,
    date: input.date,
    time_start: input.time_start,
    time_end: input.time_end,
    is_active: true,
  });
  expect(created.status).toBeLessThan(300);
  const list = await call<FlashsaleRow[]>('GET', '/ecom/daily-flashsale/list');
  const row = (list.body ?? []).find((f) => f.promotion_name === input.name);
  if (!row) throw new Error(`สร้าง flashsale ${input.name} แล้วแต่หาไม่เจอใน list`);
  return row.promotion_id;
}

/** สินค้าที่มีหน่วย ราคา และสต็อก — หยิบจาก promo-board ตัวเดียวกับ promo-basket.e2e-spec.ts */
async function pickProduct(): Promise<string> {
  const board = await call<{
    products: Array<{
      pro_code: string;
      pro_stock: number;
      units: Array<{ price: number }>;
    }>;
  }>('GET', `/ecom/special-collection/promo-board/${PROMO_ID}`);
  expect(board.status).toBe(200);
  const found = (board.body?.products ?? []).find(
    (p) => p.units.length > 0 && p.units[0].price > 0 && p.pro_stock > 10,
  );
  if (!found) throw new Error(`โปร ${PROMO_ID} ไม่มีสินค้าที่มีสต็อกให้ทดสอบ flashsale`);
  return found.pro_code;
}

async function clearCart(): Promise<void> {
  // กระเช้าค้างจากชุดอื่นทำให้ inCarts มีแถวเกิน — product-delete-cart ลบเฉพาะสินค้าเดี่ยว
  const baskets = await call<Array<{ basket_id: number }>>(
    'GET',
    '/ecom/special-collection/basket',
  );
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

describe('flashsale ในคอลเลกชันพิเศษ (e2e)', () => {
  let liveId = 0;
  let endedId = 0;
  let upcomingId = 0;
  let collectionId = 0;
  let proCode = '';

  beforeAll(async () => {
    const login = await call<{ token: string }>('POST', '/ecom/login', {
      username: USERNAME,
      password: PASSWORD,
    });
    if (login.status >= 400 || !login.body?.token) {
      throw new Error(
        `ล็อกอินบัญชีทดสอบไม่ได้ (HTTP ${login.status}) — ดู test/README-e2e.md`,
      );
    }
    token = login.body.token;
    memCode = String(
      (
        JSON.parse(
          Buffer.from(token.split('.')[1], 'base64').toString('utf8'),
        ) as { mem_code?: string }
      ).mem_code ?? '',
    );

    proCode = await pickProduct();
    liveId = await createFlashsale({
      name: `${TAG} live`,
      date: today(),
      time_start: clockPlus(-30),
      time_end: clockPlus(60),
    });
    endedId = await createFlashsale({
      name: `${TAG} ended`,
      date: yesterday(),
      time_start: '08:00:00',
      time_end: '09:00:00',
    });
    upcomingId = await createFlashsale({
      name: `${TAG} upcoming`,
      date: today(),
      time_start: clockPlus(90),
      time_end: clockPlus(120),
    });
    for (const id of [liveId, endedId, upcomingId]) {
      const added = await call('POST', '/ecom/daily-flashsale/add-product', {
        promotion_id: id,
        pro_code: proCode,
        limit: 50,
      });
      expect(added.status).toBeLessThan(300);
    }

    const collection = await call<{ collection_id: number }>(
      'POST',
      '/admin/special-collection',
      { name: TAG, status: true, audience_scope: 'all' },
    );
    expect(collection.status).toBeLessThan(300);
    collectionId = collection.body.collection_id;
    for (const id of [liveId, endedId, upcomingId]) {
      const item = await call('POST', `/admin/special-collection/${collectionId}/item`, {
        ref_type: 'flashsale',
        ref_id: String(id),
      });
      expect(item.status).toBeLessThan(300);
    }
  }, 60_000);

  beforeEach(clearCart);

  afterAll(async () => {
    await clearCart();
    if (collectionId) {
      await call('DELETE', `/admin/special-collection/${collectionId}`);
    }
    for (const id of [liveId, endedId, upcomingId]) {
      if (id) await call('DELETE', '/ecom/daily-flashsale/delete-flashsale', { id });
    }
  });

  it('ลูกค้าเห็นตัวที่กำลังลดและตัวที่ยังไม่เริ่ม แต่ไม่เห็นตัวที่จบแล้ว', async () => {
    const mine = await call<MyCollections>('GET', '/ecom/special-collection/my');
    expect(mine.status).toBe(200);
    const col = mine.body.collections.find((c) => c.collection_id === collectionId);
    expect(col).toBeDefined();

    const byRef = new Map(col!.items.map((i) => [i.ref_id, i]));
    expect(byRef.has(String(endedId))).toBe(false);

    const live = byRef.get(String(liveId))!;
    expect(live.payload?.live).toBe(true);
    expect(live.payload?.product_count).toBe(1);
    expect(live.payload?.date).toBe(today());

    const upcoming = byRef.get(String(upcomingId))!;
    expect(upcoming.payload?.live).toBe(false);
    expect(upcoming.payload?.promotion_name).toBe(`${TAG} upcoming`);
  });

  it('แอดมินเห็นตัวที่จบแล้วเป็น unavailable แทนที่จะหายเงียบ', async () => {
    const detail = await call<{ items: ResolvedItem[] }>(
      'GET',
      `/admin/special-collection/${collectionId}`,
    );
    expect(detail.status).toBe(200);
    const ended = detail.body.items.find((i) => i.ref_id === String(endedId));
    expect(ended?.unavailable).toBe(true);
    // แอดมินต้องอ่านออกว่ารายการที่จบไปแล้วคืออะไร ไม่ใช่เห็นแค่ ref_id
    expect(ended?.display_name).toBe(`${TAG} ended`);
    const live = detail.body.items.find((i) => i.ref_id === String(liveId));
    expect(live?.unavailable).toBe(false);
    expect(live?.display_name).toBe(`${TAG} live`);
  });

  it('endpoint สินค้าใน flashsale คืนหน่วย ราคา A และสถานะ live', async () => {
    const res = await call<FlashsaleDetail>(
      'GET',
      `/ecom/special-collection/flashsale/${liveId}`,
    );
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
    expect(res.body.flashsaleProducts).toHaveLength(1);
    const line = res.body.flashsaleProducts[0];
    expect(line.product.pro_code).toBe(proCode);
    expect(line.limit).toBe(50);
    expect(line.product.units.length).toBeGreaterThan(0);
    expect(Number(line.product.pro_priceA)).toBeGreaterThan(0);

    const soon = await call<FlashsaleDetail>(
      'GET',
      `/ecom/special-collection/flashsale/${upcomingId}`,
    );
    expect(soon.body.live).toBe(false);

    const missing = await call('GET', '/ecom/special-collection/flashsale/999999999');
    expect(missing.status).toBe(404);
  });

  it('หน้าแรก (get-flashsale) ยังเห็นเฉพาะรอบที่กำลังลด — refactor query ร่วมต้องไม่เปลี่ยนพฤติกรรม', async () => {
    const home = await call<Array<{ promotion_id: number; flashsaleProducts: unknown[] }>>(
      'POST',
      '/ecom/daily-flashsale/get-flashsale',
      { limit: 50, mem_code: memCode },
    );
    expect(home.status).toBeLessThan(300);
    const ids = (home.body ?? []).map((f) => f.promotion_id);
    expect(ids).toContain(liveId);
    expect(ids).not.toContain(upcomingId);
    expect(ids).not.toContain(endedId);
  });

  it('ใส่สินค้า flashsale ลงตะกร้าแล้ว endpoint สะท้อนจำนวนในตะกร้า', async () => {
    const detail = await call<FlashsaleDetail>(
      'GET',
      `/ecom/special-collection/flashsale/${liveId}`,
    );
    const unit = detail.body.flashsaleProducts[0].product.units.find(
      (u) => u.level === 1,
    )!;
    const added = await call('POST', '/ecom/product-add-cart', {
      mem_code: memCode,
      pro_code: proCode,
      pro_unit: unit.unit_name,
      amount: 2,
      flashsale_end: `${today()} ${clockPlus(60)}`,
    });
    expect(added.status).toBeLessThan(300);

    const after = await call<FlashsaleDetail>(
      'GET',
      `/ecom/special-collection/flashsale/${liveId}`,
    );
    const inCarts = after.body.flashsaleProducts[0].product.inCarts;
    expect(inCarts).toHaveLength(1);
    expect(Number(inCarts[0].spc_amount)).toBe(2);
    expect(inCarts[0].spc_unit).toBe(unit.unit_name);
  });
});
