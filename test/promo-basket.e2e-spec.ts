/**
 * E2E — กระเช้าโปรโมชั่น (ECWC-496)
 *
 * ยิง HTTP ใส่ backend ที่รันอยู่จริง ไม่ได้ boot AppModule ในเทส
 * เพราะต้องการทดสอบทั้ง stack รวม guard / DB / การคำนวณจริง
 *
 * ต้องมีก่อนรัน:
 *   1. backend รันอยู่           npm run start:dev
 *   2. MySQL + Kafka ใน docker   docker compose up -d db-ecommerce-services-demo zookeeper kafka
 *   3. บัญชีทดสอบใน DB           ดู test/README-e2e.md
 *
 * รัน:  npm run test:e2e -- promo-basket
 *       E2E_BASE_URL=http://localhost:3021 npm run test:e2e -- promo-basket
 */

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3021';
const API = `${BASE}/api`;
const USERNAME = process.env.E2E_USERNAME ?? 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';
const PROMO_ID = Number(process.env.E2E_PROMO_ID ?? 189);

interface BoardUnit {
  level: number;
  unit_name: string;
  ratio: number;
  price: number;
}
interface BoardProduct {
  pro_code: string;
  pro_name: string;
  pro_stock: number;
  units: BoardUnit[];
}
interface BoardTier {
  threshold: number;
  is_unit: boolean;
}
interface Board {
  tiers: BoardTier[];
  products: BoardProduct[];
}
interface BasketLine {
  spc_id: number;
  pro_code: string;
  qty: number;
}
interface BasketReward {
  pro_code: string;
  pro_name: string;
  unit_name: string;
  qty: number;
}
interface Basket {
  basket_id: number;
  lines: BasketLine[];
  qualifies: boolean;
  total_amount: number;
  rewards: BasketReward[];
  rewards_shared: boolean;
}
interface RemoveResult {
  removed?: string;
  needs_confirm?: boolean;
  threshold?: number;
}
interface ApiResult<T = unknown> {
  status: number;
  body: T;
}
interface CartItem {
  pro_code: string;
  shopping_cart: Array<{ is_reward: boolean; spc_amount: string | number }>;
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
    /* บาง endpoint คืน text เปล่า */
  }
  return { status: res.status, body: parsed as T };
}

/** ล้างกระเช้าของโปรนี้ให้เกลี้ยง เทสจะได้เริ่มจากสถานะเดียวกันทุกครั้ง */
async function clearBaskets(): Promise<void> {
  const res = await call<Array<{ basket_id: number }>>(
    'GET',
    `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
  );
  for (const basket of res.body ?? []) {
    await call('DELETE', `/ecom/special-collection/basket/${basket.basket_id}`);
  }
}

describe('กระเช้าโปรโมชั่น (e2e)', () => {
  let threshold = 0;
  let bigLine: { pro_code: string; unit_level: number; qty: number };
  let bigUnitName = '';
  let smallLine: { pro_code: string; unit_level: number; qty: number };

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

    const board = await call<Board>(
      'GET',
      `/ecom/special-collection/promo-board/${PROMO_ID}`,
    );
    expect(board.status).toBe(200);
    threshold = board.body.tiers[0].threshold;

    const usable = board.body.products.filter(
      (p: BoardProduct) => p.units.length > 0 && p.units[0].price > 0,
    );
    if (usable.length < 2) {
      throw new Error(`โปร ${PROMO_ID} มีสินค้าที่ใช้ทดสอบไม่พอ`);
    }

    const big = usable[0];
    const small = usable.find((p: BoardProduct) => p.pro_code !== big.pro_code);
    if (!small) throw new Error('หาสินค้าตัวที่สองไม่เจอ');
    bigLine = {
      pro_code: big.pro_code,
      unit_level: big.units[0].level,
      // ให้บรรทัดเดียวเกินเกณฑ์ เพื่อให้ลบบรรทัดเล็กแล้วยังผ่านเกณฑ์อยู่
      qty: Math.ceil((threshold * 1.2) / big.units[0].price),
    };
    bigUnitName = big.units[0].unit_name;
    smallLine = {
      pro_code: small.pro_code,
      unit_level: small.units[0].level,
      qty: 1,
    };
  }, 30_000);

  beforeEach(clearBaskets);
  afterAll(clearBaskets);

  it('ปฏิเสธการสร้างกระเช้าที่ยอดไม่ถึงเกณฑ์ขั้นต่ำ', async () => {
    const res = await call('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [smallLine],
    });

    expect(res.status).toBe(409);
  });

  it('ปฏิเสธกระเช้าที่ไม่มีสินค้าเลย', async () => {
    const res = await call('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [],
    });

    expect(res.status).toBe(400);
  });

  it('สร้างกระเช้าที่ถึงเกณฑ์แล้วอ่านกลับมาได้ครบ', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine, smallLine] },
    );
    expect(created.status).toBe(201);

    const listed = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].lines).toHaveLength(2);
    expect(listed.body[0].qualifies).toBe(true);
    expect(listed.body[0].total_amount).toBeGreaterThanOrEqual(threshold);
  });

  it('เอาสินค้าออกได้ทีละรายการเมื่อยอดที่เหลือยังถึงเกณฑ์', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine, smallLine] },
    );
    const listed = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    const target = listed.body[0].lines.find(
      (l: BasketLine) => l.pro_code === smallLine.pro_code,
    );
    if (!target) throw new Error('หาบรรทัดที่จะลบไม่เจอ');

    const res = await call<{ removed: string }>(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}/line/${target.spc_id}`,
    );

    expect(res.body.removed).toBe('line');
  });

  it('ขอยืนยันก่อน และยังไม่ลบอะไร เมื่อเอาออกแล้วจะต่ำกว่าเกณฑ์', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );
    const before = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    const target = before.body[0].lines[0];

    const res = await call<RemoveResult>(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}/line/${target.spc_id}`,
    );

    expect(res.body.needs_confirm).toBe(true);
    expect(res.body.threshold).toBe(threshold);

    // สำคัญ: ต้องไม่ลบอะไรจริงตอนที่ยังไม่ยืนยัน
    const after = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    expect(after.body[0].lines).toHaveLength(before.body[0].lines.length);
  });

  it('ยกกระเช้าออกทั้งก้อนเมื่อยืนยันแล้ว', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );
    const listed = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    const target = listed.body[0].lines[0];

    const res = await call<{ removed: string }>(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}/line/${target.spc_id}?confirm=true`,
    );

    expect(res.body.removed).toBe('basket');

    const after = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    expect(after.body).toHaveLength(0);
  });

  it('กระเช้าเข้า/ออกแล้ว cart_version ต้องขยับ ให้แท็บอื่นรู้ว่าตะกร้าเปลี่ยน', async () => {
    const versionOf = async () => {
      const res = await call<{ cartVersion: string | number }>(
        'GET',
        `/ecom/product-cart/${memCode}`,
      );
      return BigInt(res.body.cartVersion);
    };

    const v0 = await versionOf();
    const created = await call<{ basket_id: number; cartVersion: string }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );
    expect(created.status).toBe(201);
    const v1 = await versionOf();
    expect(v1).toBeGreaterThan(v0);
    // response ต้องคืน version ใหม่ให้หน้าบ้านเก็บได้เลย
    expect(BigInt(created.body.cartVersion)).toBe(v1);

    await call('DELETE', `/ecom/special-collection/basket/${created.body.basket_id}`);
    expect(await versionOf()).toBeGreaterThan(v1);
  });

  it('ของแถมถูกคิดใหม่ทันทีเมื่อกระเช้าเข้าและออกจากตะกร้า', async () => {
    const rewardRows = async () => {
      const res = await call<{ cart: CartItem[] }>(
        'GET',
        `/ecom/product-cart/${memCode}`,
      );
      return res.body.cart.filter((item) =>
        item.shopping_cart.some((sc) => sc.is_reward),
      );
    };

    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );
    expect(created.status).toBe(201);
    // ถึงเกณฑ์แล้ว engine ต้องแจกของแถมโดยไม่ต้องรอให้ลูกค้าแตะตะกร้าอีกครั้ง
    expect((await rewardRows()).length).toBeGreaterThan(0);

    await call('DELETE', `/ecom/special-collection/basket/${created.body.basket_id}`);
    // กระเช้าหาย ของแถมต้องหายตาม ไม่ค้างเป็นแถวลอยๆ
    expect(await rewardRows()).toHaveLength(0);
  });

  it('การ์ดกระเช้าคืนของแถมที่ได้จริงมาด้วย ไม่ต้องให้หน้าบ้านเดาเอง', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine, smallLine] },
    );
    expect(created.status).toBe(201);

    const listed = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    const basket = listed.body.find(
      (b) => b.basket_id === created.body.basket_id,
    );
    expect(basket?.qualifies).toBe(true);
    expect(basket?.rewards_shared).toBe(false);
    expect(basket?.rewards.length).toBeGreaterThan(0);

    // ต้องตรงกับแถว is_reward ที่อยู่ในตะกร้าจริง ทั้งชื่อและจำนวน
    const cart = await call<{ cart: CartItem[] }>(
      'GET',
      `/ecom/product-cart/${memCode}`,
    );
    const rewardRows = (cart.body?.cart ?? []).flatMap((item) =>
      item.shopping_cart
        .filter((sc) => sc.is_reward)
        .map((sc) => ({ pro_code: item.pro_code, qty: Number(sc.spc_amount) })),
    );
    for (const reward of basket!.rewards) {
      const row = rewardRows.find((r) => r.pro_code === reward.pro_code);
      expect(row).toBeDefined();
      expect(reward.qty).toBe(row!.qty);
      expect(reward.pro_name.length).toBeGreaterThan(0);
    }
  });

  it('ลบกระเช้าทั้งก้อนได้โดยตรง', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );

    const res = await call<{ deleted: boolean }>(
      'DELETE',
      `/ecom/special-collection/basket/${created.body.basket_id}`,
    );

    expect(res.body.deleted).toBe(true);
  });

  it('สินค้าเดี่ยวกับแถวในกระเช้าไม่ปนกัน แม้เป็นสินค้าตัวเดียวกัน', async () => {
    const created = await call<{ basket_id: number }>(
      'POST',
      '/ecom/special-collection/basket',
      { promo_id: PROMO_ID, lines: [bigLine] },
    );
    expect(created.status).toBe(201);
    const before = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    const lineBefore = before.body[0].lines[0];

    // ใส่สินค้าตัวเดียวกัน หน่วยเดียวกัน แบบเดี่ยว — ต้องไม่ไปบวกเข้าบรรทัดของกระเช้า
    const added = await call('POST', '/ecom/product-add-cart', {
      mem_code: memCode,
      pro_code: bigLine.pro_code,
      pro_unit: bigUnitName,
      amount: 1,
    });
    expect(added.status).toBeLessThan(400);

    const afterAdd = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    expect(afterAdd.body[0].lines).toHaveLength(1);
    expect(afterAdd.body[0].lines[0].qty).toBe(lineBefore.qty);

    // ลบสินค้าเดี่ยวตัวนั้นออกจากตะกร้า — แถวในกระเช้าต้องยังอยู่ครบ
    const deleted = await call('POST', '/ecom/product-delete-cart', {
      mem_code: memCode,
      pro_code: bigLine.pro_code,
    });
    expect(deleted.status).toBeLessThan(400);

    const afterDelete = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );
    expect(afterDelete.body).toHaveLength(1);
    expect(afterDelete.body[0].basket_id).toBe(created.body.basket_id);
    expect(afterDelete.body[0].lines).toHaveLength(1);
    expect(afterDelete.body[0].lines[0].qty).toBe(lineBefore.qty);
  });

  it('ปฏิเสธเมื่อสั่งเกินสต็อกที่มี', async () => {
    const board = await call<Board>(
      'GET',
      `/ecom/special-collection/promo-board/${PROMO_ID}`,
    );
    const product = board.body.products.find(
      (p: BoardProduct) => p.units.length > 0 && p.pro_stock > 0,
    );
    if (!product) throw new Error('ไม่มีสินค้าที่มีสต็อกให้ทดสอบ');
    const unit = product.units[0];
    // ขอเกินสต็อกที่มีไปมาก แต่ยอดเงินยังเกินเกณฑ์ เพื่อให้ติดที่สต็อกล้วนๆ
    const overQty = Math.ceil(product.pro_stock / unit.ratio) + 1000;

    const res = await call<Board>('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [
        { pro_code: product.pro_code, unit_level: unit.level, qty: overQty },
      ],
    });

    expect(res.status).toBe(409);
    expect(String((res.body as { message?: string })?.message)).toContain(
      'มีไม่พอ',
    );
  });

  it('กันไม่ให้เข้าถึงกระเช้าของคนอื่น', async () => {
    const res = await call(
      'DELETE',
      '/ecom/special-collection/basket/999999999',
    );

    expect(res.status).toBe(404);
  });

  it('ปฏิเสธทุก endpoint เมื่อไม่มี token', async () => {
    const saved = token;
    token = '';
    try {
      const res = await call(
        'GET',
        `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
      );
      expect(res.status).toBe(401);
    } finally {
      token = saved;
    }
  });
});
