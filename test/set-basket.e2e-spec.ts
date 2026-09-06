/**
 * E2E — กระเช้าสำเร็จรูป (bundle_set) เข้าตะกร้า (ECWC-496 ข้อ 6.2 ทาง A)
 *
 * ยิง HTTP ใส่ backend ที่รันอยู่จริง เหมือน promo-basket.e2e-spec.ts
 * ต้องมี bundle_set ที่ active อย่างน้อย 1 ชุด (seed: SET-DEMO-01)
 *
 * รัน:  npm run test:e2e -- set-basket
 */

// ทำให้ไฟล์เป็น module — ไม่งั้น const ระดับบนชนกับ promo-basket.e2e-spec.ts ตอน type-check
export {};

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3021';
const API = `${BASE}/api`;
const USERNAME = process.env.E2E_USERNAME ?? 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';

interface SetLine {
  pro_code: string;
  qty: number;
  is_gift: boolean;
}
interface SetView {
  set_code: string;
  set_name: string;
  price: number;
  list_total: number;
  items: SetLine[];
  gifts: SetLine[];
  availability: { available_sets: number };
}
interface BasketLine {
  spc_id: number;
  pro_code: string;
  qty: number;
  line_total: number;
  is_gift: boolean;
}
interface Basket {
  basket_id: number;
  kind: 'promo' | 'set';
  set_code: string | null;
  set_name: string | null;
  set_qty: number | null;
  lines: BasketLine[];
  total_amount: number;
}
interface CartItem {
  pro_code: string;
  shopping_cart: Array<{ is_reward: boolean }>;
}
interface ApiResult<T = unknown> {
  status: number;
  body: T;
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

/** ล้างทั้งกระเช้า (ทุกชนิด) และสินค้าเดี่ยว ให้ยอดตะกร้าเริ่มที่ 0 ทุกเคส */
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

const summary = async (): Promise<number> => {
  const res = await call<number>('GET', '/ecom/cart/summary');
  return Number(res.body);
};

describe('กระเช้าสำเร็จรูปในตะกร้า (e2e)', () => {
  let set: SetView;

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

    const sets = await call<SetView[]>('GET', '/ecom/bundle-set');
    expect(sets.status).toBe(200);
    const usable = (sets.body ?? []).find(
      (s) => s.availability.available_sets >= 2 && s.price > 0,
    );
    if (!usable) throw new Error('ไม่มี bundle_set ที่ active และมีสต็อกพอสำหรับทดสอบ');
    set = usable;
  }, 30_000);

  beforeEach(clearCart);
  afterAll(clearCart);

  it('ใส่ตะกร้าแล้วเห็นเป็นกระเช้าชนิด set ราคารวมเท่าราคาชุด และของแถมเป็น 0', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket/set',
      { set_code: set.set_code, qty: 1 },
    );
    expect(created.status).toBe(201);

    const listed = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    expect(listed.body).toHaveLength(1);
    const basket = listed.body[0];
    expect(basket.kind).toBe('set');
    expect(basket.set_code).toBe(set.set_code);
    expect(basket.set_qty).toBe(1);
    expect(basket.lines).toHaveLength(set.items.length + set.gifts.length);

    // ราคาชุดต้องกระจายลงบรรทัดที่จ่ายแล้วรวมกันได้พอดี ไม่มีเศษสตางค์หาย
    const paid = basket.lines.filter((l) => !l.is_gift);
    const paidSum = paid.reduce((sum, l) => sum + l.line_total, 0);
    expect(Math.round(paidSum * 100) / 100).toBe(set.price);
    expect(basket.total_amount).toBe(set.price);
    for (const gift of basket.lines.filter((l) => l.is_gift)) {
      expect(gift.line_total).toBe(0);
    }
  });

  it('ยอดรวมตะกร้าคิดที่ราคาชุด ไม่ใช่ราคาเต็มของสินค้าข้างใน', async () => {
    expect(await summary()).toBe(0);

    await call('POST', '/ecom/special-collection/basket/set', {
      set_code: set.set_code,
      qty: 2,
    });

    // list_total คือราคาเต็ม ถ้า summary ไปคิดจาก product จะได้ list_total*2 แทน
    expect(await summary()).toBe(Math.round(set.price * 2 * 100) / 100);
  });

  it('แบ่งขายไม่ได้ — เอาออกทีละชิ้นต้องถูกปฏิเสธ ยกออกทั้งชุดได้', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket/set',
      { set_code: set.set_code, qty: 1 },
    );
    const listed = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    const line = listed.body[0].lines[0];

    const removed = await call(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}/line/${line.spc_id}`,
    );
    expect(removed.status).toBe(409);

    const still = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    expect(still.body[0].lines).toHaveLength(listed.body[0].lines.length);

    const deleted = await call<{ deleted: boolean }>(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}`,
    );
    expect(deleted.body.deleted).toBe(true);
    expect(await summary()).toBe(0);
  });

  it('ปฏิเสธเมื่อสั่งเกินจำนวนชุดที่ประกอบได้', async () => {
    const res = await call<{ message?: string }>(
      'POST',
      '/ecom/special-collection/basket/set',
      { set_code: set.set_code, qty: set.availability.available_sets + 1 },
    );
    expect(res.status).toBe(409);
  });

  it('ปฏิเสธชุดที่ไม่มีอยู่ และ payload ที่ผิดรูป', async () => {
    const missing = await call('POST', '/ecom/special-collection/basket/set', {
      set_code: 'NO-SUCH-SET',
      qty: 1,
    });
    expect(missing.status).toBe(404);

    const bad = await call('POST', '/ecom/special-collection/basket/set', {
      set_code: set.set_code,
      qty: 0,
    });
    expect(bad.status).toBe(400);
  });

  it('สินค้าเดี่ยวตัวเดียวกันไม่ไปปนกับบรรทัดในกระเช้าสำเร็จรูป', async () => {
    await call('POST', '/ecom/special-collection/basket/set', {
      set_code: set.set_code,
      qty: 1,
    });
    const before = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    const lineBefore = before.body[0].lines.find((l) => !l.is_gift) as BasketLine;

    const product = await call<{
      pro_unit1?: string;
      units?: Array<{ unit_name: string }>;
    }>('GET', `/ecom/product-cart/get-one/${encodeURIComponent(lineBefore.pro_code)}`);
    const unitName =
      product.body?.pro_unit1 ?? product.body?.units?.[0]?.unit_name ?? '';
    if (unitName) {
      const added = await call('POST', '/ecom/product-add-cart', {
        mem_code: memCode,
        pro_code: lineBefore.pro_code,
        pro_unit: unitName,
        amount: 1,
      });
      expect(added.status).toBeLessThan(400);
    }

    const after = await call<Basket[]>('GET', '/ecom/special-collection/basket');
    const lineAfter = after.body[0].lines.find(
      (l) => l.spc_id === lineBefore.spc_id,
    ) as BasketLine;
    expect(lineAfter.qty).toBe(lineBefore.qty);
    expect(lineAfter.line_total).toBe(lineBefore.line_total);
  });
});
