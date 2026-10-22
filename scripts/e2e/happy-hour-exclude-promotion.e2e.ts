/**
 * E2E: ECWC-747 Happy Hour ไม่รวมกับ Promotion (Company Day / Wang Day)
 *
 * ใช้ (local เท่านั้น — สคริปต์เขียน DB ตรงเพื่อ seed/คืนค่า):
 *   ECWC747_ALLOW_LOCAL_WRITES=1 E2E_BASE_URL=http://localhost:3021 \
 *   npx ts-node scripts/e2e/happy-hour-exclude-promotion.e2e.ts
 *
 * ต้องมี: backend รันอยู่แล้ว · users.mem_code='E2E-TEST' (ต้นแบบสมาชิก) · INTERNAL_API_TOKEN ใน .env
 *   (ถ้าไม่มี ข้ามเคส checkout-preview ของระบบขาย)
 * seed: สมาชิก/สินค้า/โปร ชื่อขึ้นต้น "E2E local ECWC747" + slot Happy Hour ครอบทั้งวัน
 *   ระหว่างเทส: เปิด happy_hour_config, ปิด slot อื่นชั่วคราว, สลับ flag happy_hour_exclude_promotion
 *   จบ (finally): ลบ seed + order ของสมาชิก E2E, คืน config / is_active ของ slot เดิม / flag เดิม
 * ผลลัพธ์เขียนลง docs/e2e/happy-hour-exclude-promotion-local-<timestamp>.md
 */
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
const MEMBER = 'E2E-ECWC747';
const P_CD = 'E2E747-CD'; // อยู่ในเงื่อนไขโปร
const P_NORMAL = 'E2E747-NORMAL'; // ไม่อยู่ในโปร
const P_GIFT = 'E2E747-GIFT'; // ของแถมโปร
const P_HH = 'E2E747-HH'; // ของรางวัล Happy Hour
const PRODUCTS = [P_CD, P_NORMAL, P_GIFT, P_HH];
const PROMO_NAME = 'E2E local ECWC747 company day';
const FLAG = 'happy_hour_exclude_promotion';
const UNIT = 'ชิ้น';
const logger = new Logger('HappyHourExcludePromotionE2E');

const results: Array<{
  name: string;
  status: 'passed' | 'failed';
  detail?: string;
}> = [];
let db: Connection;
let ownsFixtures = false;
let promoId = 0;
let tierId = 0;
let slotId = 0;
let token = '';
let configSnapshot: RowDataPacket | null = null;
let activeSlotIds: number[] = [];
let flagSnapshot: boolean | null = null; // null = ไม่มีแถว flag มาก่อน

interface CountRow extends RowDataPacket {
  count: number;
}
interface ApiResponse {
  status: number;
  body: unknown;
}

function record(value: unknown): Record<string, unknown> {
  assert(
    value !== null && typeof value === 'object' && !Array.isArray(value),
    `expected response object, got ${JSON.stringify(value)?.slice(0, 200)}`,
  );
  return value as Record<string, unknown>;
}

async function call(
  method: string,
  path: string,
  body?: unknown,
  headers: Record<string, string> = { Authorization: `Bearer ${token}` },
): Promise<ApiResponse> {
  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30000),
  });
  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // ไม่ใช่ JSON — เก็บเป็น text
  }
  return { status: response.status, body: parsed };
}

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    results.push({ name, status: 'passed' });
    logger.log(`PASS ${name}`);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'failed', detail });
    logger.error(`FAIL ${name}: ${detail}`);
  }
}

async function setFlag(status: boolean): Promise<void> {
  const r = await call('POST', '/ecom/feature-flag/update-flag', {
    flag: FLAG,
    status,
  });
  assert(r.status < 300, `update-flag ${status} → ${r.status}`);
}

async function addToCart(pro_code: string, amount: number): Promise<void> {
  const r = await call('POST', '/ecom/product-add-cart', {
    mem_code: MEMBER,
    pro_code,
    pro_unit: UNIT,
    amount,
  });
  assert(r.status < 300, `add ${pro_code} → ${r.status} ${JSON.stringify(r.body)}`);
}

async function cartPreview(): Promise<Record<string, unknown>> {
  const r = await call('POST', '/admin/happy-hour/cart-preview', {});
  assert(r.status < 300, `cart-preview → ${r.status} ${JSON.stringify(r.body)}`);
  return record(r.body);
}

async function setup(): Promise<void> {
  const [existing] = await db.query<CountRow[]>(
    'SELECT (SELECT COUNT(*) FROM users WHERE mem_code=?)+(SELECT COUNT(*) FROM product WHERE pro_code IN (?,?,?,?))+(SELECT COUNT(*) FROM promotion WHERE promo_name=?) AS count',
    [MEMBER, ...PRODUCTS, PROMO_NAME],
  );
  assert.equal(Number(existing[0].count), 0, 'refuse to touch existing ECWC747 fixtures (run with ECWC747_CLEANUP_ONLY=1)');

  const [configs] = await db.query<RowDataPacket[]>(
    'SELECT is_enabled,start_date,end_date FROM happy_hour_config WHERE id=1',
  );
  configSnapshot = configs[0] ?? null;
  const [slots] = await db.query<(RowDataPacket & { id: number })[]>(
    'SELECT id FROM happy_hour_slot WHERE is_active=1',
  );
  activeSlotIds = slots.map((s) => s.id);
  const [flags] = await db.query<(RowDataPacket & { is_enabled: number })[]>(
    'SELECT is_enabled FROM feature_flag WHERE feature_key=?',
    [FLAG],
  );
  flagSnapshot = flags.length ? Boolean(flags[0].is_enabled) : null;

  await db.beginTransaction();
  try {
    const [created] = await db.execute<ResultSetHeader>(
      "INSERT INTO users (mem_code,mem_username,mem_password,mem_nameSite,mem_price,mem_route,permision_admin,role) SELECT ?,?,mem_password,?,'C',NULL,1,'User' FROM users WHERE mem_code='E2E-TEST'",
      [MEMBER, 'e2e_ecwc747', 'E2E local ECWC747'],
    );
    assert.equal(created.affectedRows, 1, 'seed member E2E-TEST must exist');
    for (const code of PRODUCTS) {
      const price = code === P_CD || code === P_NORMAL ? 1000 : 10;
      await db.execute(
        'INSERT INTO product (pro_code,pro_name,pro_priceA,pro_priceB,pro_priceC,pro_stock,pro_lowest_stock,pro_l16_only,free_product_count,free_product_limit) VALUES (?,?,?,?,?,1000,0,0,0,NULL)',
        [code, `E2E local ECWC747 ${code}`, price, price, price],
      );
      await db.execute(
        'INSERT INTO product_unit (pro_code,unit_name,ratio,level) VALUES (?,?,1,1)',
        [code, UNIT],
      );
    }
    const [promotion] = await db.execute<ResultSetHeader>(
      'INSERT INTO promotion (promo_name,start_date,end_date,status) VALUES (?,DATE_SUB(NOW(),INTERVAL 1 DAY),DATE_ADD(NOW(),INTERVAL 1 DAY),1)',
      [PROMO_NAME],
    );
    promoId = promotion.insertId;
    const [tier] = await db.execute<ResultSetHeader>(
      "INSERT INTO promotion_tier (tier_name,min_amount,promo_id,all_products,is_unit) VALUES ('ECWC747 local tier',1000,?,0,0)",
      [promoId],
    );
    tierId = tier.insertId;
    await db.execute(
      'INSERT INTO promotion_condition (product_code,tier_id) VALUES (?,?)',
      [P_CD, tierId],
    );
    await db.execute(
      "INSERT INTO promotion_reward (product_gcode,tier_id,qty,unit) VALUES (?,?,1,'1')",
      [P_GIFT, tierId],
    );

    // slot ครอบทั้งวัน (00:00–24:00) เพื่อไม่ขึ้นกับเวลาที่รัน — ปิด slot อื่นชั่วคราว (ไม่งั้น getOne อาจได้ slot เดิม)
    if (activeSlotIds.length) {
      await db.query('UPDATE happy_hour_slot SET is_active=0 WHERE id IN (?)', [
        activeSlotIds,
      ]);
    }
    const [slot] = await db.execute<ResultSetHeader>(
      "INSERT INTO happy_hour_slot (start_time,end_time,min_order_amount,card_value,excess_threshold,discount_per_step,is_active,reward_amount,reward_type,reward_value,min_order_scope) VALUES ('00:00:00','24:00:00',1000,100,500,10,1,1,'card',0,'all')",
    );
    slotId = slot.insertId;
    await db.execute(
      'INSERT INTO happy_hour_slot_reward (pro_code,unit,amount,slot_id) VALUES (?,?,1,?)',
      [P_HH, UNIT, slotId],
    );
    await db.execute(
      'INSERT INTO happy_hour_config (id,is_enabled,start_date,end_date) VALUES (1,1,NULL,NULL) ON DUPLICATE KEY UPDATE is_enabled=1,start_date=NULL,end_date=NULL',
    );
    await db.commit();
    ownsFixtures = true;
  } catch (error: unknown) {
    await db.rollback();
    throw error;
  }

  const secret = process.env.ACCESS_TOKEN_SECRET;
  assert(secret, 'local signing secret must be configured');
  token = await new JwtService({ secret }).signAsync(
    {
      mem_code: MEMBER,
      username: MEMBER,
      name: 'E2E local ECWC747',
      price_option: 'C',
      mem_route: '',
      permission: true,
      role: 'User',
    },
    { expiresIn: '20m' },
  );
}

async function exercise(): Promise<void> {
  // ตะกร้า: CD 1 ชิ้น (1,000 → ถึง tier โปร) + NORMAL 2 ชิ้น (2,000)
  await test('add cart lines; promotion line is tagged with promo_id', async () => {
    await addToCart(P_CD, 1);
    await addToCart(P_NORMAL, 2);
    const [rows] = await db.query<(RowDataPacket & { pro_code: string; promo_id: number | null })[]>(
      'SELECT pro_code,promo_id FROM shopping_cart WHERE mem_code=? AND is_reward=0 ORDER BY pro_code',
      [MEMBER],
    );
    const byCode = new Map(rows.map((r) => [r.pro_code, r.promo_id]));
    assert.equal(byCode.get(P_CD), promoId, 'CD line tagged');
    assert.equal(byCode.get(P_NORMAL), null, 'NORMAL line untagged');
  });

  await test('flag OFF: cart-preview counts the whole cart (legacy)', async () => {
    await setFlag(false);
    const p = await cartPreview();
    assert.equal(p.is_happy_hour, true);
    assert.equal(Number(p.qualifying_amount), 3000);
    assert.equal(Number(p.num_cards), 3);
    assert.equal(p.promotion_excluded_amount, undefined);
  });

  await test('flag ON: cart-preview drops the Company Day line', async () => {
    await setFlag(true);
    const p = await cartPreview();
    assert.equal(p.is_happy_hour, true);
    assert.equal(Number(p.qualifying_amount), 2000);
    assert.equal(Number(p.num_cards), 2);
    assert.equal(Number(p.promotion_excluded_amount), 1000);
  });

  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (internalToken) {
    await test('flag ON: sales checkout-preview drops the promotion line', async () => {
      const r = await call(
        'POST',
        '/ecom/internal/checkout-preview',
        {
          mem_code: MEMBER,
          lines: [
            { pro_code: P_CD, unit: UNIT, qty: 1 },
            { pro_code: P_NORMAL, unit: UNIT, qty: 2 },
          ],
        },
        { 'x-internal-token': internalToken },
      );
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const hh = record(record(r.body).happy_hour);
      assert.equal(Number(hh.qualifying_amount), 2000);
      assert.equal(Number(hh.num_cards), 2);
    });
  } else {
    results.push({
      name: 'sales checkout-preview',
      status: 'passed',
      detail: 'SKIPPED — INTERNAL_API_TOKEN not set',
    });
  }

  await test('flag ON: submit-order saves 2 cards + discount from non-promotion lines only', async () => {
    const r = await call('POST', '/ecom/submit-order', {
      mem_code: MEMBER,
      priceOption: 'C',
      emp_code: null,
      listFree: null,
      paymentOptions: 'wang-credit',
      shippingOptions: 'wang',
      addressed: null,
    });
    assert(r.status < 300, `submit → ${r.status} ${JSON.stringify(r.body)}`);
    const running = (r.body as string[])[0];
    assert(running, 'running number returned');
    const [heads] = await db.query<(RowDataPacket & { discount: string; soh_sumprice: string })[]>(
      'SELECT discount,soh_sumprice FROM shopping_head WHERE soh_running=?',
      [running],
    );
    assert.equal(Number(heads[0].soh_sumprice), 3000, 'bill total still includes promotion line');
    assert.equal(Number(heads[0].discount), 200, 'discount = 2 cards × 100');
    const [hh] = await db.query<(RowDataPacket & { pro_code: string; spo_qty: string })[]>(
      'SELECT pro_code,spo_qty FROM shopping_order WHERE soh_running=? AND is_happy_hour=1',
      [running],
    );
    assert.equal(hh.length, 1);
    assert.equal(hh[0].pro_code, P_HH);
    assert.equal(Number(hh[0].spo_qty), 2);
  });

  await test('flag ON: cart with only promotion lines gets no Happy Hour', async () => {
    await addToCart(P_CD, 2);
    const p = await cartPreview();
    assert.equal(p.is_happy_hour, false);
    assert.equal(Number(p.promotion_excluded_amount), 2000);
  });
}

async function cleanup(): Promise<void> {
  if (!ownsFixtures) return;
  await db.beginTransaction();
  try {
    await db.execute(
      'DELETE o FROM shopping_order o JOIN shopping_head h ON h.soh_running=o.soh_running WHERE h.mem_code=?',
      [MEMBER],
    );
    await db.execute('DELETE FROM sale_log WHERE mem_code=?', [MEMBER]);
    await db.execute('DELETE FROM shopping_head WHERE mem_code=?', [MEMBER]);
    await db.execute('DELETE FROM shopping_cart WHERE mem_code=?', [MEMBER]);
    await db.execute('DELETE FROM cart_basket WHERE mem_code=?', [MEMBER]);
    if (tierId) {
      await db.execute('DELETE FROM promotion_reward WHERE tier_id=?', [tierId]);
      await db.execute('DELETE FROM promotion_condition WHERE tier_id=?', [tierId]);
      await db.execute('DELETE FROM promotion_tier WHERE tier_id=?', [tierId]);
    }
    await db.execute('DELETE FROM promotion WHERE promo_name=?', [PROMO_NAME]);
    if (slotId) {
      await db.execute('DELETE FROM happy_hour_slot_reward WHERE slot_id=?', [slotId]);
      await db.execute('DELETE FROM happy_hour_slot WHERE id=?', [slotId]);
    }
    if (activeSlotIds.length) {
      await db.query('UPDATE happy_hour_slot SET is_active=1 WHERE id IN (?)', [
        activeSlotIds,
      ]);
    }
    if (configSnapshot) {
      await db.execute(
        'UPDATE happy_hour_config SET is_enabled=?,start_date=?,end_date=? WHERE id=1',
        [configSnapshot.is_enabled, configSnapshot.start_date, configSnapshot.end_date],
      );
    }
    if (flagSnapshot === null) {
      await db.execute('DELETE FROM feature_flag WHERE feature_key=?', [FLAG]);
    } else {
      await db.execute('UPDATE feature_flag SET is_enabled=? WHERE feature_key=?', [
        flagSnapshot,
        FLAG,
      ]);
    }
    await db.execute('DELETE FROM product_unit WHERE pro_code IN (?,?,?,?)', PRODUCTS);
    await db.execute('DELETE FROM imagedebug WHERE pro_code IN (?,?,?,?)', PRODUCTS);
    await db.execute('DELETE FROM product WHERE pro_code IN (?,?,?,?)', PRODUCTS);
    await db.execute('DELETE FROM users WHERE mem_code=?', [MEMBER]);
    await db.commit();
    const [remaining] = await db.query<CountRow[]>(
      'SELECT (SELECT COUNT(*) FROM users WHERE mem_code=?)+(SELECT COUNT(*) FROM product WHERE pro_code IN (?,?,?,?))+(SELECT COUNT(*) FROM promotion WHERE promo_name=?)+(SELECT COUNT(*) FROM shopping_head WHERE mem_code=?)+(SELECT COUNT(*) FROM happy_hour_slot WHERE id=?) AS count',
      [MEMBER, ...PRODUCTS, PROMO_NAME, MEMBER, slotId],
    );
    assert.equal(Number(remaining[0].count), 0, 'fixture cleanup readback');
    ownsFixtures = false;
  } catch (error: unknown) {
    await db.rollback();
    throw error;
  }
}

async function writeReport(failure: string | null): Promise<string> {
  const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD']).toString().trim();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = `docs/e2e/happy-hour-exclude-promotion-local-${stamp}.md`;
  const lines = [
    '# E2E — ECWC-747 Happy Hour ไม่รวมกับ Promotion',
    '',
    `- environment: **local** (${BASE}, DB ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME})`,
    `- commit: \`${sha}\``,
    `- เวลา: ${new Date().toISOString()}`,
    `- ผล: ${results.filter((r) => r.status === 'passed').length}/${results.length} ผ่าน${failure ? ` — error: ${failure}` : ''}`,
    '',
    '| # | เคส | ผล | หมายเหตุ |',
    '|---|-----|----|----------|',
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.name} | ${r.status === 'passed' ? '✅' : '❌'} | ${(r.detail ?? '').replace(/\|/g, '\\|')} |`,
    ),
    '',
  ];
  await mkdir('docs/e2e', { recursive: true });
  await writeFile(file, lines.join('\n'), 'utf8');
  return file;
}

async function main(): Promise<void> {
  assert.equal(process.env.ECWC747_ALLOW_LOCAL_WRITES, '1', 'set ECWC747_ALLOW_LOCAL_WRITES=1 only for authorized local run');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(BASE).hostname), 'HTTP endpoint must be local');
  assert(['localhost', '127.0.0.1'].includes(process.env.DB_HOST ?? ''), 'DB host must be local');
  assert.equal(process.env.DB_NAME, 'ecommerce-db', 'use reviewed local database');
  const ready = await fetch(`${BASE}/api/ecom/feature-flag/all`, { signal: AbortSignal.timeout(3000) });
  assert.equal(ready.status, 200, 'backend must already be running');
  db = await createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  let failure: string | null = null;
  try {
    await setup();
    await exercise();
  } catch (error: unknown) {
    failure = error instanceof Error ? error.message : String(error);
  } finally {
    const had = ownsFixtures;
    try {
      await cleanup();
      results.push({ name: had ? 'fixtures removed + config/slot/flag restored' : 'no fixture changes committed', status: 'passed' });
    } catch (error: unknown) {
      failure = `cleanup failed: ${error instanceof Error ? error.message : String(error)}`;
      results.push({ name: 'cleanup', status: 'failed', detail: failure });
    }
    await db.end();
  }
  const file = await writeReport(failure);
  logger.log(`report: ${file}`);
  if (failure || results.some((r) => r.status === 'failed')) process.exitCode = 1;
}

void main();
