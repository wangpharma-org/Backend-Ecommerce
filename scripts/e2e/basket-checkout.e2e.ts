import 'dotenv/config';
import { strict as assert } from 'node:assert';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  createConnection,
  type Connection,
  type ResultSetHeader,
  type RowDataPacket,
} from 'mysql2/promise';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3021';
const MEMBERS = ['E2E-ECWC655', 'E2E-ECWC655-B'];
const PRODUCTS = ['E2E655-PAID', 'E2E655-OTHER', 'E2E655-GIFT'];
const PROMO_NAME = 'E2E local ECWC655 isolated checkout';
const logger = new Logger('BasketCheckoutE2E');
const results: Array<{
  name: string;
  status: 'passed' | 'failed';
  detail?: string;
}> = [];
let db: Connection;
let ownsFixtures = false;
let promoId = 0;
let tierId = 0;
let token = '';
let foreignToken = '';

interface CartRow extends RowDataPacket {
  spc_id: number;
  pro_code: string;
  spc_amount: string;
  spc_checked: number;
  basket_id: number | null;
  is_reward: number;
}
interface CountRow extends RowDataPacket {
  count: number;
}
interface OrderRow extends RowDataPacket {
  pro_code: string;
  spo_qty: string;
  spo_total_decimal: string;
  is_reward: number;
}
interface ApiResponse {
  status: number;
  body: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function record(value: unknown): Record<string, unknown> {
  assert(isRecord(value), 'expected response object');
  return value;
}
function array(value: unknown): unknown[] {
  assert(Array.isArray(value), 'expected response array');
  return value;
}
function positiveId(value: unknown): number {
  assert(
    typeof value === 'number' && Number.isSafeInteger(value) && value > 0,
    'expected positive response ID',
  );
  return value;
}
async function call(
  method: string,
  path: string,
  body?: object,
  bearer = token,
): Promise<ApiResponse> {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  const parsed: unknown = text === '' ? null : JSON.parse(text);
  return { status: response.status, body: parsed };
}
async function check(name: string, work: () => Promise<void>): Promise<void> {
  try {
    await work();
    results.push({ name, status: 'passed' });
    logger.log(`PASS ${name}`);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'failed', detail });
    throw error;
  }
}
async function cartRows(): Promise<CartRow[]> {
  const [rows] = await db.query<CartRow[]>(
    'SELECT spc_id,pro_code,spc_amount,spc_checked,basket_id,is_reward FROM shopping_cart WHERE mem_code=? ORDER BY spc_id',
    [MEMBERS[0]],
  );
  return rows;
}
async function addAppliedCodeReward(member: string): Promise<number> {
  const [created] = await db.execute<ResultSetHeader>(
    "INSERT INTO shopping_cart (mem_code,pro_code,spc_amount,spc_unit_enum,spc_checked,is_reward,use_code,promo_id,tier_id,spc_datetime,basket_id) VALUES (?,?,1,'1',1,1,1,?,?,NOW(),NULL)",
    [member, PRODUCTS[2], promoId, tierId],
  );
  return created.insertId;
}
async function orderCount(): Promise<number> {
  const [rows] = await db.query<CountRow[]>(
    'SELECT COUNT(*) AS count FROM shopping_head WHERE mem_code=?',
    [MEMBERS[0]],
  );
  return Number(rows[0].count);
}
async function cartVersion(): Promise<bigint> {
  const [rows] = await db.query<(RowDataPacket & { cart_version: string })[]>(
    'SELECT cart_version FROM users WHERE mem_code=?',
    [MEMBERS[0]],
  );
  return BigInt(rows[0].cart_version);
}
async function createBasket(qty = 2, bearer = token): Promise<number> {
  const response = await call(
    'POST',
    '/ecom/special-collection/basket',
    {
      promo_id: promoId,
      lines: [{ pro_code: PRODUCTS[0], unit_level: 1, qty }],
    },
    bearer,
  );
  assert.equal(response.status, 201, 'create dedicated basket');
  return positiveId(record(response.body).basket_id);
}
function submitBody(basketId: number): object {
  return {
    basket_id: basketId,
    mem_code: MEMBERS[0],
    priceOption: 'C',
    emp_code: null,
    listFree: null,
    paymentOptions: 'wang-credit',
    shippingOptions: 'wang',
    addressed: null,
  };
}

async function setup(): Promise<void> {
  const [existing] = await db.query<CountRow[]>(
    'SELECT (SELECT COUNT(*) FROM users WHERE mem_code IN (?,?))+(SELECT COUNT(*) FROM product WHERE pro_code IN (?,?,?))+(SELECT COUNT(*) FROM promotion WHERE promo_name=?) AS count',
    [...MEMBERS, ...PRODUCTS, PROMO_NAME],
  );
  assert.equal(
    Number(existing[0].count),
    0,
    'refuse to touch existing ECWC655 fixtures',
  );
  await db.beginTransaction();
  try {
    for (let index = 0; index < MEMBERS.length; index++) {
      const [created] = await db.execute<ResultSetHeader>(
        "INSERT INTO users (mem_code,mem_username,mem_password,mem_nameSite,mem_price,mem_route,permision_admin,role) SELECT ?,?,mem_password,?,'C',NULL,1,'User' FROM users WHERE mem_code='E2E-TEST'",
        [MEMBERS[index], `e2e_ecwc655_${index}`, `ECWC655 local ${index}`],
      );
      assert.equal(created.affectedRows, 1, 'test seed member must exist');
    }
    for (let index = 0; index < PRODUCTS.length; index++) {
      const price = index === 0 ? 60 : index === 1 ? 7 : 10;
      await db.execute(
        'INSERT INTO product (pro_code,pro_name,pro_priceA,pro_priceB,pro_priceC,pro_stock,pro_lowest_stock,pro_l16_only,free_product_count,free_product_limit) VALUES (?,?,?,?,?,1000,0,0,0,NULL)',
        [
          PRODUCTS[index],
          `E2E local ECWC655 product ${index}`,
          price,
          price,
          price,
        ],
      );
      await db.execute(
        "INSERT INTO product_unit (pro_code,unit_name,ratio,level) VALUES (?,'ชิ้น',1,1)",
        [PRODUCTS[index]],
      );
    }
    const [promotion] = await db.execute<ResultSetHeader>(
      'INSERT INTO promotion (promo_name,start_date,end_date,status) VALUES (?,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),1)',
      [PROMO_NAME],
    );
    promoId = promotion.insertId;
    const [tier] = await db.execute<ResultSetHeader>(
      "INSERT INTO promotion_tier (tier_name,min_amount,promo_id,all_products,is_unit) VALUES ('ECWC655 local tier',100,?,0,0)",
      [promoId],
    );
    tierId = tier.insertId;
    await db.execute(
      'INSERT INTO promotion_condition (product_code,tier_id) VALUES (?,?)',
      [PRODUCTS[0], tierId],
    );
    await db.execute(
      "INSERT INTO promotion_reward (product_gcode,tier_id,qty,unit) VALUES (?,?,1,'1')",
      [PRODUCTS[2], tierId],
    );
    await db.commit();
    ownsFixtures = true;
  } catch (error: unknown) {
    await db.rollback();
    throw error;
  }
  const secret = process.env.ACCESS_TOKEN_SECRET;
  assert(secret, 'local signing secret must be configured');
  const jwt = new JwtService({ secret });
  const payload = (member: string) => ({
    mem_code: member,
    username: member,
    name: 'ECWC655 local',
    price_option: 'C',
    mem_route: '',
    permission: true,
    role: 'User',
  });
  token = await jwt.signAsync(payload(MEMBERS[0]), { expiresIn: '20m' });
  foreignToken = await jwt.signAsync(payload(MEMBERS[1]), { expiresIn: '20m' });
}

async function cleanup(): Promise<void> {
  if (!ownsFixtures) return;
  await db.beginTransaction();
  try {
    await db.execute(
      'DELETE o FROM shopping_order o JOIN shopping_head h ON h.soh_running=o.soh_running WHERE h.mem_code IN (?,?)',
      MEMBERS,
    );
    await db.execute('DELETE FROM sale_log WHERE mem_code IN (?,?)', MEMBERS);
    await db.execute(
      'DELETE FROM shopping_head WHERE mem_code IN (?,?)',
      MEMBERS,
    );
    await db.execute(
      'DELETE FROM shopping_cart WHERE mem_code IN (?,?)',
      MEMBERS,
    );
    await db.execute(
      'DELETE FROM cart_basket WHERE mem_code IN (?,?)',
      MEMBERS,
    );
    await db.execute('DELETE FROM promotion_reward WHERE tier_id=?', [tierId]);
    await db.execute('DELETE FROM promotion_condition WHERE tier_id=?', [
      tierId,
    ]);
    await db.execute('DELETE FROM promotion_tier WHERE tier_id=?', [tierId]);
    await db.execute(
      'DELETE FROM promotion WHERE promo_id=? AND promo_name=?',
      [promoId, PROMO_NAME],
    );
    await db.execute(
      'DELETE FROM product_unit WHERE pro_code IN (?,?,?)',
      PRODUCTS,
    );
    await db.execute(
      'DELETE FROM imagedebug WHERE pro_code IN (?,?,?)',
      PRODUCTS,
    );
    await db.execute('DELETE FROM product WHERE pro_code IN (?,?,?)', PRODUCTS);
    await db.execute('DELETE FROM users WHERE mem_code IN (?,?)', MEMBERS);
    await db.commit();
    const [remaining] = await db.query<CountRow[]>(
      'SELECT (SELECT COUNT(*) FROM users WHERE mem_code IN (?,?))+(SELECT COUNT(*) FROM product WHERE pro_code IN (?,?,?))+(SELECT COUNT(*) FROM promotion WHERE promo_id=?)+(SELECT COUNT(*) FROM shopping_cart WHERE mem_code IN (?,?))+(SELECT COUNT(*) FROM cart_basket WHERE mem_code IN (?,?))+(SELECT COUNT(*) FROM shopping_head WHERE mem_code IN (?,?))+(SELECT COUNT(*) FROM imagedebug WHERE pro_code IN (?,?,?)) AS count',
      [
        ...MEMBERS,
        ...PRODUCTS,
        promoId,
        ...MEMBERS,
        ...MEMBERS,
        ...MEMBERS,
        ...PRODUCTS,
      ],
    );
    assert.equal(
      Number(remaining[0].count),
      0,
      'dedicated fixture cleanup readback',
    );
    ownsFixtures = false;
  } catch (error: unknown) {
    await db.rollback();
    throw error;
  }
}

/** Recover only fixtures created by a prior interrupted run of this suite. */
async function loadExistingFixturesForCleanup(): Promise<void> {
  const [promotions] = await db.query<(RowDataPacket & { promo_id: number })[]>(
    'SELECT promo_id FROM promotion WHERE promo_name=?',
    [PROMO_NAME],
  );
  assert.equal(
    promotions.length,
    1,
    'expected exactly one dedicated promotion',
  );
  promoId = promotions[0].promo_id;
  const [tiers] = await db.query<(RowDataPacket & { tier_id: number })[]>(
    'SELECT tier_id FROM promotion_tier WHERE promo_id=?',
    [promoId],
  );
  assert.equal(tiers.length, 1, 'expected exactly one dedicated tier');
  tierId = tiers[0].tier_id;
  const [members] = await db.query<
    (RowDataPacket & { mem_code: string; mem_username: string })[]
  >('SELECT mem_code,mem_username FROM users WHERE mem_code IN (?,?)', MEMBERS);
  assert.equal(
    members.length,
    MEMBERS.length,
    'expected only dedicated members',
  );
  assert(
    members.every(
      (member) =>
        MEMBERS.includes(member.mem_code) &&
        member.mem_username.startsWith('e2e_ecwc655_'),
    ),
  );
  const [products] = await db.query<
    (RowDataPacket & { pro_code: string; pro_name: string })[]
  >(
    'SELECT pro_code,pro_name FROM product WHERE pro_code IN (?,?,?)',
    PRODUCTS,
  );
  assert.equal(
    products.length,
    PRODUCTS.length,
    'expected only dedicated products',
  );
  assert(
    products.every(
      (product) =>
        PRODUCTS.includes(product.pro_code) &&
        product.pro_name.startsWith('E2E local ECWC655 product'),
    ),
  );
  ownsFixtures = true;
}

async function exercise(): Promise<void> {
  const target = await createBasket();
  const otherBasket = await createBasket();
  const foreignBasket = await createBasket(2, foreignToken);
  for (const code of PRODUCTS.slice(0, 2)) {
    const response = await call('POST', '/ecom/product-add-cart', {
      mem_code: MEMBERS[0],
      pro_code: code,
      pro_unit: 'ชิ้น',
      amount: 1,
    });
    assert(response.status < 300, 'add dedicated ordinary product');
  }
  const unchecked = await call('POST', '/ecom/product-check-cart', {
    mem_code: MEMBERS[0],
    pro_code: PRODUCTS[1],
    type: 'uncheck',
  });
  assert(unchecked.status < 300, 'uncheck dedicated ordinary product');
  const existingCodeGiftId = await addAppliedCodeReward(MEMBERS[0]);
  const baseline = await cartRows();
  const unrelated = baseline.filter(
    (row) => row.basket_id !== target && row.is_reward === 0,
  );
  assert(unrelated.some((row) => row.basket_id === otherBasket));
  assert(
    unrelated.some((row) => row.basket_id === null && row.spc_checked === 0),
  );

  await check(
    'scoped product-cart includes only target paid rows and scoped gifts',
    async () => {
      const response = await call(
        'GET',
        `/ecom/product-cart/${MEMBERS[0]}?basket_id=${target}`,
      );
      assert.equal(response.status, 200);
      const rows = array(record(response.body).cart).flatMap((item) =>
        array(record(item).shopping_cart).map(record),
      );
      const paid = rows.filter((row) => !row.is_reward && !row.hotdeal_free);
      const gifts = rows.filter((row) => row.is_reward);
      assert.equal(paid.length, 1);
      assert.equal(
        gifts.length,
        1,
        'previously applied code gift must not join target basket',
      );
      assert(
        baseline.some(
          (row) =>
            row.basket_id === target && row.spc_id === Number(paid[0].spc_id),
        ),
      );
      assert.equal(Number(paid[0].spc_amount), 2);
      assert.deepEqual(
        await cartRows(),
        baseline,
        'preview must preserve saved rows and checks',
      );
    },
  );
  await check(
    'scoped summary uses target120 rather than combined300',
    async () => {
      const scoped = await call(
        'GET',
        `/ecom/cart/summary?basket_id=${target}`,
      );
      assert.equal(scoped.status, 200);
      assert.equal(scoped.body, 120);
      const global = await call('GET', '/ecom/cart/summary');
      assert.equal(global.status, 200);
      assert.equal(global.body, 300);
    },
  );
  await check(
    'Happy Hour preview carries scope and preserves persisted rows',
    async () => {
      const response = await call('POST', '/admin/happy-hour/cart-preview', {
        basket_id: target,
      });
      assert.equal(response.status, 201);
      assert.equal(typeof record(response.body).is_happy_hour, 'boolean');
      assert.deepEqual(await cartRows(), baseline);
    },
  );
  await check(
    'abandoning checkout retains basket and unrelated selection',
    async () => {
      const response = await call('GET', '/ecom/special-collection/basket');
      assert.equal(response.status, 200);
      const baskets = array(response.body).map(record);
      assert(baskets.some((basket) => basket.basket_id === target));
      assert.deepEqual(await cartRows(), baseline);
    },
  );
  await check(
    'invalid/missing/foreign scope never falls back to full cart',
    async () => {
      for (const id of ['0', '-1', 'no', '1.5', '', '9007199254740992']) {
        assert.equal(
          (await call('GET', `/ecom/cart/summary?basket_id=${id}`)).status,
          400,
        );
      }
      assert.equal(
        (await call('GET', `/ecom/cart/summary?basket_id=${foreignBasket}`))
          .status,
        404,
      );
      assert.equal(
        (await call('GET', '/ecom/cart/summary?basket_id=2147483647')).status,
        404,
      );
      assert.equal(
        (
          await call(
            'GET',
            `/ecom/product-cart/${MEMBERS[0]}?basket_id=${foreignBasket}`,
          )
        ).status,
        404,
      );
      assert.equal(
        (
          await call('POST', '/admin/happy-hour/cart-preview', {
            basket_id: foreignBasket,
          })
        ).status,
        404,
      );
      assert.equal(
        (
          await call('POST', '/admin/happy-hour/cart-preview', {
            basket_id: 'no',
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call('POST', '/ecom/submit-order', {
            ...submitBody(target),
            basket_id: 'no',
          })
        ).status,
        400,
      );
      assert.equal(
        (await call('POST', '/ecom/submit-order', submitBody(foreignBasket)))
          .status,
        404,
      );
      assert.equal(await orderCount(), 0);
      assert.deepEqual(await cartRows(), baseline);
    },
  );
  await check(
    'transaction failure rolls back order writes and basket cleanup',
    async () => {
      const version = await cartVersion();
      await db.execute(
        'UPDATE product SET free_product_count=2147483647 WHERE pro_code=?',
        [PRODUCTS[2]],
      );
      const response = await call(
        'POST',
        '/ecom/submit-order',
        submitBody(target),
      );
      assert(
        response.status >= 500,
        'dedicated gift counter overflow must fail transaction',
      );
      assert.equal(await orderCount(), 0);
      assert.deepEqual(await cartRows(), baseline);
      assert.equal(
        await cartVersion(),
        version,
        'failed transaction preserves cart version',
      );
      const [gift] = await db.query<
        (RowDataPacket & { free_product_count: number })[]
      >('SELECT free_product_count FROM product WHERE pro_code=?', [
        PRODUCTS[2],
      ]);
      assert.equal(gift[0].free_product_count, 2147483647);
      await db.execute(
        'UPDATE product SET free_product_count=0 WHERE pro_code=?',
        [PRODUCTS[2]],
      );
    },
  );
  await check(
    'successful retry orders target and scoped gift, preserving other rows/checks',
    async () => {
      const version = await cartVersion();
      const response = await call(
        'POST',
        '/ecom/submit-order',
        submitBody(target),
      );
      assert.equal(response.status, 201);
      const running = array(response.body);
      assert.equal(running.length, 1);
      assert.equal(typeof running[0], 'string');
      const [orders] = await db.query<OrderRow[]>(
        'SELECT o.pro_code,o.spo_qty,o.spo_total_decimal,o.is_reward FROM shopping_order o JOIN shopping_head h ON h.soh_running=o.soh_running WHERE h.mem_code=? ORDER BY o.is_reward',
        [MEMBERS[0]],
      );
      assert.equal(orders.length, 2);
      assert.equal(orders[0].pro_code, PRODUCTS[0]);
      assert.equal(Number(orders[0].spo_qty), 2);
      assert.equal(Number(orders[0].spo_total_decimal), 120);
      assert.equal(orders[1].pro_code, PRODUCTS[2]);
      assert.equal(Number(orders[1].spo_qty), 1);
      const remaining = await cartRows();
      assert(!remaining.some((row) => row.basket_id === target));
      assert.deepEqual(
        remaining.filter((row) => row.is_reward === 0),
        unrelated,
      );
      const remainingGifts = remaining.filter(
        (row) => row.is_reward === 1 && row.pro_code === PRODUCTS[2],
      );
      assert.equal(remainingGifts.length, 2);
      assert(
        remainingGifts.some((row) => row.spc_id === existingCodeGiftId),
        'eligible applied code gift stays in cart',
      );
      assert(
        remainingGifts.every((row) => Number(row.spc_amount) === 1),
        'remaining paid180 earns its own gift',
      );
      assert(
        (await cartVersion()) > version,
        'successful cleanup bumps cart version',
      );
      const [baskets] = await db.query<CountRow[]>(
        'SELECT COUNT(*) AS count FROM cart_basket WHERE basket_id=?',
        [target],
      );
      assert.equal(
        Number(baskets[0].count),
        0,
        'purchased basket header removed immediately',
      );
    },
  );
  await check('consumed basket retry cannot create another order', async () => {
    assert(
      [404, 409].includes(
        (await call('POST', '/ecom/submit-order', submitBody(target))).status,
      ),
    );
    assert.equal(await orderCount(), 1);
    assert(
      [404, 409].includes(
        (await call('GET', `/ecom/cart/summary?basket_id=${target}`)).status,
      ),
    );
  });
  await check('concurrent duplicate submit commits exactly once', async () => {
    const duplicate = await createBasket();
    const response = await Promise.all([
      call('POST', '/ecom/submit-order', submitBody(duplicate)),
      call('POST', '/ecom/submit-order', submitBody(duplicate)),
    ]);
    assert.equal(response.filter((item) => item.status === 201).length, 1);
    assert.equal(
      response.filter((item) => item.status === 404 || item.status === 409)
        .length,
      1,
    );
    assert.equal(await orderCount(), 2);
    assert.deepEqual(
      (await cartRows()).filter((row) => row.is_reward === 0),
      unrelated,
    );
  });
  await check(
    'ineligible applied code gift is removed by existing rule after basket purchase',
    async () => {
      const expiringCodeGiftId = await addAppliedCodeReward(MEMBERS[1]);
      const response = await call(
        'POST',
        '/ecom/submit-order',
        submitBody(foreignBasket),
        foreignToken,
      );
      assert.equal(response.status, 201);
      const [orders] = await db.query<OrderRow[]>(
        'SELECT o.pro_code,o.spo_qty,o.spo_total_decimal,o.is_reward FROM shopping_order o JOIN shopping_head h ON h.soh_running=o.soh_running WHERE h.mem_code=?',
        [MEMBERS[1]],
      );
      assert.equal(
        orders.length,
        2,
        'old code gift must not be part of basket order',
      );
      const [remaining] = await db.query<CountRow[]>(
        'SELECT COUNT(*) AS count FROM shopping_cart WHERE spc_id=? AND mem_code=?',
        [expiringCodeGiftId, MEMBERS[1]],
      );
      assert.equal(
        Number(remaining[0].count),
        0,
        'code gift loses eligibility after its only paid basket is purchased',
      );
    },
  );
}

async function main(): Promise<void> {
  assert.equal(
    process.env.ECWC655_ALLOW_LOCAL_WRITES,
    '1',
    'set ECWC655_ALLOW_LOCAL_WRITES=1 only for authorized local integration run',
  );
  assert(
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname),
    'HTTP endpoint must be local',
  );
  assert(
    ['localhost', '127.0.0.1'].includes(process.env.DB_HOST ?? ''),
    'DB host must be local',
  );
  assert.equal(
    process.env.DB_NAME,
    'ecommerce-db',
    'use reviewed local database',
  );
  const ready = await fetch(`${BASE}/api/ecom/feature-flag/all`, {
    signal: AbortSignal.timeout(3000),
  });
  assert.equal(
    ready.status,
    200,
    'backend must already be started by coordinator',
  );
  db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  let failure: string | null = null;
  try {
    if (process.env.ECWC655_CLEANUP_ONLY === '1') {
      await loadExistingFixturesForCleanup();
    } else {
      await setup();
      await exercise();
    }
  } catch (error: unknown) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    const committedFixtures = ownsFixtures;
    try {
      await cleanup();
      results.push({
        name: committedFixtures
          ? 'dedicated fixtures fully removed'
          : 'no fixture changes committed',
        status: 'passed',
      });
    } catch (error: unknown) {
      failure = `cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      results.push({
        name: 'dedicated fixtures fully removed',
        status: 'failed',
        detail: failure,
      });
    }
    await db.end();
    await mkdir('docs/e2e', { recursive: true });
    const executedAtUTC = new Date().toISOString();
    const dirtyFiles = execFileSync('git', ['status', '--porcelain'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);
    const git = {
      commit: execFileSync('git', ['rev-parse', 'HEAD'], {
        encoding: 'utf8',
      }).trim(),
      branch: execFileSync('git', ['branch', '--show-current'], {
        encoding: 'utf8',
      }).trim(),
      dirtyWorktree: dirtyFiles.length > 0,
      dirtyFiles,
    };
    const report = {
      issue: 'ECWC-655',
      environment: 'local',
      executedAtUTC,
      endpoint: BASE,
      database: {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        name: process.env.DB_NAME,
      },
      git,
      fixtureMembers: MEMBERS,
      fixtureProducts: PRODUCTS,
      results,
      failure,
      limitation:
        'local HTTP/MySQL integration only; Kafka delivery, deployed code, mobile device and downstream picking are unverified',
    };
    const reportBase = `docs/e2e/basket-checkout-local-${executedAtUTC.replace(/[:.]/g, '-')}`;
    await writeFile(
      `${reportBase}.json`,
      JSON.stringify(report, null, 2) + '\n',
    );
    await writeFile(
      `${reportBase}.md`,
      `# ECWC-655 local integration\n\nEnvironment: local\n\n${report.executedAtUTC}\n\nCommit: ${git.commit}\n\nBranch: ${git.branch}\n\nDirty worktree: ${git.dirtyWorktree}\n\n` +
        `Changed paths:\n\n${git.dirtyFiles.map((file) => `- ${file}`).join('\n') || 'none'}\n\n` +
        results
          .map(
            (result) =>
              `- ${result.status}: ${result.name}${result.detail ? ` — ${result.detail}` : ''}`,
          )
          .join('\n') +
        `\n\n${report.limitation}\n${failure ? `\nFailure: ${failure}\n` : ''}`,
    );
    logger.log(`Report: ${reportBase}.md`);
  }
  if (failure) throw new Error(failure);
}

main().catch((error: unknown) => {
  logger.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
