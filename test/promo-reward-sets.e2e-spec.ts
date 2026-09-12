/**
 * E2E — จำนวนชุดของแถมที่บอกลูกค้า ต้องตรงกับที่ engine แจกจริง (ECWC-496 review)
 *
 * รีวิวเจอว่าหน้าบอร์ด/ตะกร้าขึ้น "ได้ของแถม 1 เซต" เสมอ ทั้งที่ยอดหลายเท่าของเกณฑ์
 * ได้ของแถมหลายชุด เทสชุดนี้ล็อกไว้ว่าตัวเลขทุกทาง (board / preview / basket / ตะกร้าจริง)
 * ต้องพูดตรงกัน
 *
 * ต้องมีก่อนรัน: ดู test/README-e2e.md
 * รัน:  npm run test:e2e -- promo-reward-sets
 */

export {};

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
  pro_stock: number;
  units: BoardUnit[];
}
interface BoardReward {
  pro_code: string;
  qty: number;
  total_qty: number;
}
interface BoardTier {
  tier_id: number;
  threshold: number;
  is_unit: boolean;
  progress: number;
  reached: boolean;
  multiplier: number;
  rewards: BoardReward[];
}
interface Board {
  tiers: BoardTier[];
  products: BoardProduct[];
  summary: { reward_sets: number; reward_items: number };
}
interface Preview {
  amount: number;
  units: number;
  tiers: BoardTier[];
  reward_sets: number;
  reward_items: number;
}
interface Basket {
  basket_id: number;
  reward_sets: number;
  reached_tier_count: number;
}
interface CartResponse {
  cart: Array<{
    pro_code: string;
    shopping_cart: Array<{ is_reward: boolean; spc_amount: string }>;
  }>;
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
    /* บาง endpoint คืน text เปล่า */
  }
  return { status: res.status, body: parsed as T };
}

async function clearBaskets(): Promise<void> {
  const res = await call<Array<{ basket_id: number }>>(
    'GET',
    `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
  );
  for (const basket of res.body ?? []) {
    await call('DELETE', `/ecom/special-collection/basket/${basket.basket_id}`);
  }
}

/** จำนวนของแถมทั้งหมดที่อยู่ในตะกร้าจริงตอนนี้ (แถวที่ is_reward) */
async function rewardUnitsInCart(): Promise<number> {
  const res = await call<CartResponse>('GET', `/ecom/product-cart/${memCode}`);
  return (res.body.cart ?? []).reduce(
    (total, item) =>
      total +
      item.shopping_cart
        .filter((row) => row.is_reward)
        .reduce((sum, row) => sum + Number(row.spc_amount), 0),
    0,
  );
}

describe('จำนวนชุดของแถม (e2e)', () => {
  let threshold = 0;
  /** บรรทัดที่ยอดเป็น 3 เท่าของเกณฑ์พอดีหรือมากกว่า → ต้องได้ของแถม 3 ชุดขึ้นไป */
  let tripleLine: { pro_code: string; unit_level: number; qty: number };
  let expectedSets = 0;

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
    const tier = board.body.tiers[0];
    if (tier.is_unit) {
      throw new Error(
        `โปร ${PROMO_ID} ขั้นแรกนับเป็นจำนวนชิ้น — เทสนี้ต้องการขั้นที่นับเป็นบาท`,
      );
    }
    threshold = tier.threshold;

    const usable = board.body.products.filter(
      (product) =>
        product.units.length > 0 &&
        product.units[0].price > 0 &&
        product.pro_stock > 0,
    );
    if (usable.length === 0) {
      throw new Error(`โปร ${PROMO_ID} ไม่มีสินค้าที่ใช้ทดสอบได้`);
    }

    // เลือกหน่วยที่สั่งไม่กี่ชิ้นแล้วยอดถึง 3 เท่าของเกณฑ์ และสต็อกพอ
    const product = usable[0];
    const unit =
      [...product.units].reverse().find((u) => u.price > 0) ??
      product.units[0];
    const qty = Math.ceil((threshold * 3) / unit.price);
    if (qty * unit.ratio > product.pro_stock) {
      throw new Error(
        `สต็อกของ ${product.pro_code} ไม่พอสำหรับยอด 3 เท่าของเกณฑ์`,
      );
    }
    tripleLine = { pro_code: product.pro_code, unit_level: unit.level, qty };
    expectedSets = Math.floor((qty * unit.price) / threshold);
    expect(expectedSets).toBeGreaterThanOrEqual(3);
  }, 30_000);

  beforeEach(clearBaskets);
  afterAll(clearBaskets);

  it('พรีวิวกระเช้าที่ยอดหลายเท่าของเกณฑ์ บอกจำนวนชุดตามจริง ไม่ใช่ชุดเดียว', async () => {
    const res = await call<Preview>(
      'POST',
      `/ecom/special-collection/promo-board/${PROMO_ID}/preview`,
      { lines: [tripleLine] },
    );

    expect(res.status).toBe(201);
    expect(res.body.reward_sets).toBe(expectedSets);
    const tier = res.body.tiers.find((t) => t.threshold === threshold);
    expect(tier?.multiplier).toBe(expectedSets);
    for (const reward of tier?.rewards ?? []) {
      expect(reward.total_qty).toBe(reward.qty * expectedSets);
    }
  });

  it('พรีวิวกระเช้าว่าง ตอบว่ายังไม่ได้อะไร ไม่ใช่ error', async () => {
    const res = await call<Preview>(
      'POST',
      `/ecom/special-collection/promo-board/${PROMO_ID}/preview`,
      { lines: [] },
    );

    expect(res.status).toBe(201);
    expect(res.body.reward_sets).toBe(0);
    expect(res.body.amount).toBe(0);
  });

  it('พรีวิวบอกเท่าไหร่ ใส่ตะกร้าจริงก็ได้ของแถมเท่านั้น', async () => {
    const preview = await call<Preview>(
      'POST',
      `/ecom/special-collection/promo-board/${PROMO_ID}/preview`,
      { lines: [tripleLine] },
    );
    const before = await rewardUnitsInCart();

    const created = await call('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [tripleLine],
    });
    expect(created.status).toBe(201);

    const after = await rewardUnitsInCart();
    expect(after - before).toBe(preview.body.reward_items);
  });

  it('กระเช้าในตะกร้ารายงานจำนวนชุด ไม่ใช่จำนวนขั้นที่ถึง', async () => {
    await call('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [tripleLine],
    });

    const listed = await call<Basket[]>(
      'GET',
      `/ecom/special-collection/basket?promo_id=${PROMO_ID}`,
    );

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].reward_sets).toBe(expectedSets);
    // ขั้นที่ "ยอดถึงเกณฑ์" มีขั้นเดียว แต่ได้ของแถมหลายชุด — คนละตัวเลขกัน
    expect(listed.body[0].reached_tier_count).toBeLessThanOrEqual(expectedSets);
  });

  it('หน้าบอร์ดรายงานจำนวนชุดของทั้งตะกร้าตรงกับของแถมที่ engine แจกจริง', async () => {
    await call('POST', '/ecom/special-collection/basket', {
      promo_id: PROMO_ID,
      lines: [tripleLine],
    });

    const board = await call<Board>(
      'GET',
      `/ecom/special-collection/promo-board/${PROMO_ID}`,
    );
    const tier = board.body.tiers.find((t) => t.threshold === threshold);

    expect(tier?.multiplier).toBe(expectedSets);
    expect(board.body.summary.reward_sets).toBe(expectedSets);
    expect(board.body.summary.reward_items).toBe(await rewardUnitsInCart());
  });

  it('ปฏิเสธพรีวิวเมื่อไม่มี token', async () => {
    const saved = token;
    token = '';
    try {
      const res = await call(
        'POST',
        `/ecom/special-collection/promo-board/${PROMO_ID}/preview`,
        { lines: [] },
      );
      expect(res.status).toBe(401);
    } finally {
      token = saved;
    }
  });
});
