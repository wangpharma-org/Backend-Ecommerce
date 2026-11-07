/* eslint-disable no-console */
/**
 * E2E: ECWC-750 — เส้นตะกร้าของร้าน (ใส่ / ลบ / ติ๊ก / ติ๊กทั้งหมด / นับ) ทำกับตะกร้าของร้านใน token เท่านั้น
 *
 * ใช้ (local — สคริปต์เซ็น token เองจาก ACCESS_TOKEN_SECRET):
 *   BASE_URL=http://localhost:3054/api SHOP_A=E2E-C01 SHOP_B=E2E-C02 PRO_CODE=E2E-P02 PRO_UNIT=กล่อง \
 *   npx ts-node scripts/e2e/cart-own-shop.e2e.ts
 * ใช้ (deployed):
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod USER_TOKEN=<ร้านทดสอบ ก> OTHER_TOKEN=<ร้านทดสอบ ข> \
 *   PRO_CODE=<สินค้าที่ใส่ตะกร้าได้> PRO_UNIT=<หน่วย> [STAFF_TOKEN=<บัญชีพนักงาน permission=true>] \
 *   npx ts-node scripts/e2e/cart-own-shop.e2e.ts
 *
 * ใช้ **ร้านทดสอบสองร้านเท่านั้น** สินค้าตัวเดียวจำนวน 1 · ไม่สั่งซื้อ · จบแล้วลบสินค้าทดสอบออกจากตะกร้าทั้งสองร้าน
 * ตะกร้าร้าน ข ต้องไม่เปลี่ยนเลยระหว่างที่ร้าน ก ลอง (ตรวจด้วย cartVersion ที่ขยับทุกครั้งที่ตะกร้าเปลี่ยน)
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/cart-own-shop-<env>-<timestamp>.md
 */
import { JwtService } from '@nestjs/jwt';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? '').replace(/\/+$/, '');
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const PRO_CODE = process.env.PRO_CODE ?? '';
const PRO_UNIT = process.env.PRO_UNIT ?? '';
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

if (!BASE_URL || !E2E_ENV || !PRO_CODE || !PRO_UNIT) {
  console.error(
    'ต้องตั้ง BASE_URL, PRO_CODE, PRO_UNIT และ E2E_ENV เมื่อไม่ใช่ localhost',
  );
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error('E2E_ENV=local แต่ BASE_URL ไม่ใช่ localhost');
  process.exit(2);
}

const memOf = (token: string): string => {
  try {
    const p = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64url').toString(),
    ) as { mem_code?: unknown };
    return typeof p.mem_code === 'string' ? p.mem_code : '';
  } catch {
    return '';
  }
};

async function tokens(): Promise<{ a: string; b: string; staff?: string }> {
  if (E2E_ENV !== 'local') {
    const a = process.env.USER_TOKEN ?? '';
    const b = process.env.OTHER_TOKEN ?? '';
    if (!a || !b || memOf(a) === memOf(b)) {
      console.error(
        'deployed ต้องตั้ง USER_TOKEN และ OTHER_TOKEN ของร้านทดสอบสองร้านที่ต่างกัน',
      );
      process.exit(2);
    }
    return { a, b, staff: process.env.STAFF_TOKEN || undefined };
  }
  const secret = process.env.ACCESS_TOKEN_SECRET;
  const shopA = process.env.SHOP_A ?? '';
  const shopB = process.env.SHOP_B ?? '';
  if (!secret || !shopA || !shopB || shopA === shopB) {
    console.error(
      'local ต้องมี ACCESS_TOKEN_SECRET และ SHOP_A / SHOP_B (ร้านทดสอบในฐาน) ที่ต่างกัน',
    );
    process.exit(2);
  }
  const jwt = new JwtService({ secret });
  const sign = (p: Record<string, unknown>) =>
    jwt.signAsync(
      { name: `E2E ${E2E_ENV}`, price_option: 'C', mem_route: '', ...p },
      { expiresIn: '15m' },
    );
  return {
    a: await sign({
      mem_code: shopA,
      username: shopA,
      role: 'User',
      permission: false,
    }),
    b: await sign({
      mem_code: shopB,
      username: shopB,
      role: 'User',
      permission: false,
    }),
    staff: await sign({
      mem_code: 'E2E-S01',
      username: 'e2e-sales',
      role: 'Sales',
      permission: true,
    }),
  };
}

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown,
) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
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

type Step = {
  name: string;
  result: 'ผ่าน' | 'ไม่ผ่าน' | 'ข้าม';
  observed: string;
};
const steps: Step[] = [];
const check = (name: string, ok: boolean, observed: string) => {
  steps.push({ name, result: ok ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name} — ${observed}`);
};
const skip = (name: string, why: string) => {
  steps.push({ name, result: 'ข้าม', observed: why });
  console.log(`SKIP ${name} — ${why}`);
};

/** สถานะตะกร้าที่ร้านเจ้าของเห็นเอง (อ่านด้วย token ของร้านนั้น) */
async function snapshot(token: string, mem: string) {
  const r = await call(
    'GET',
    `/ecom/product-cart/${encodeURIComponent(mem)}`,
    token,
  );
  const b = (r.body ?? {}) as {
    cart?: unknown[];
    cartVersion?: string | number | null;
    summaryCart?: unknown;
  };
  return {
    status: r.status,
    version: String(b.cartVersion ?? ''),
    lines: Array.isArray(b.cart) ? b.cart.length : -1,
    total: Number(b.summaryCart ?? NaN),
    hasProduct: JSON.stringify(b.cart ?? []).includes(`"${PRO_CODE}"`),
  };
}
const same = (
  x: Awaited<ReturnType<typeof snapshot>>,
  y: Awaited<ReturnType<typeof snapshot>>,
) =>
  x.version === y.version &&
  x.lines === y.lines &&
  x.total === y.total &&
  x.hasProduct === y.hasProduct;
const fmt = (s: Awaited<ReturnType<typeof snapshot>>) =>
  `version ${s.version} · ${s.lines} รายการ · ยอด ${s.total} · มี ${PRO_CODE}: ${s.hasProduct}`;

async function main() {
  const t = await tokens();
  const shopA = memOf(t.a);
  const shopB = memOf(t.b);
  const startedAt = new Date();
  const add = (token: string, mem: string | undefined) =>
    call('POST', '/ecom/product-add-cart', token, {
      ...(mem === undefined ? {} : { mem_code: mem }),
      pro_code: PRO_CODE,
      pro_unit: PRO_UNIT,
      amount: 1,
    });
  const del = (token: string, mem: string) =>
    call('POST', '/ecom/product-delete-cart', token, {
      mem_code: mem,
      pro_code: PRO_CODE,
    });

  // เตรียม: ร้าน ข ใส่สินค้าทดสอบในตะกร้าตัวเอง
  const prep = await add(t.b, shopB);
  check(
    'เตรียม: ร้าน ข ใส่สินค้าในตะกร้าตัวเองได้',
    prep.status < 300,
    `HTTP ${prep.status}`,
  );
  const before = await snapshot(t.b, shopB);
  check(
    'เตรียม: ร้าน ข เห็นสินค้าในตะกร้า',
    before.status === 200 && before.hasProduct,
    fmt(before),
  );

  const noAuth = await call('POST', '/ecom/product-add-cart', undefined, {
    mem_code: shopB,
    pro_code: PRO_CODE,
    pro_unit: PRO_UNIT,
    amount: 1,
  });
  check('ไม่มี token → 401', noAuth.status === 401, `HTTP ${noAuth.status}`);

  const attempts: Array<[string, () => Promise<{ status: number }>]> = [
    ['ร้าน ก ใส่ของลงตะกร้าร้าน ข → 403', () => add(t.a, shopB)],
    ['ร้าน ก ลบของในตะกร้าร้าน ข → 403', () => del(t.a, shopB)],
    [
      'ร้าน ก เอาติ๊กออกในตะกร้าร้าน ข → 403',
      () =>
        call('POST', '/ecom/product-check-cart', t.a, {
          mem_code: shopB,
          pro_code: PRO_CODE,
          type: 'uncheck',
        }),
    ],
    [
      'ร้าน ก เอาติ๊กออกทั้งหมดในตะกร้าร้าน ข → 403',
      () =>
        call('POST', '/ecom/product-check-all-cart', t.a, {
          mem_code: shopB,
          type: 'uncheck',
        }),
    ],
    [
      'ร้าน ก นับของในตะกร้าร้าน ข → 403',
      () => call('GET', `/ecom/cart/count/${encodeURIComponent(shopB)}`, t.a),
    ],
  ];
  for (const [name, fn] of attempts) {
    const r = await fn();
    check(name, r.status === 403, `HTTP ${r.status}`);
  }
  if (t.staff) {
    const s = await add(t.staff, shopB);
    check(
      'บัญชีพนักงาน (permission=true) ใส่ของลงตะกร้าร้าน ข ผ่านเส้นนี้ → 403',
      s.status === 403,
      `HTTP ${s.status}`,
    );
  } else
    skip('บัญชีพนักงานใส่ของลงตะกร้าร้าน ข → 403', 'ไม่ได้ตั้ง STAFF_TOKEN');

  const after = await snapshot(t.b, shopB);
  check(
    'ตะกร้าร้าน ข ไม่เปลี่ยนเลย (cartVersion / จำนวน / ยอด / สินค้า เท่าเดิม)',
    same(before, after),
    `ก่อน ${fmt(before)} → หลัง ${fmt(after)}`,
  );

  // ร้าน ก ใช้ตะกร้าตัวเองได้ตามปกติ
  const ownAdd = await add(t.a, shopA);
  check(
    'ร้าน ก ใส่ของลงตะกร้าตัวเอง (ส่งรหัสตัวเอง) ได้',
    ownAdd.status < 300,
    `HTTP ${ownAdd.status}`,
  );
  const ownAddNoMem = await add(t.a, undefined);
  check(
    'ร้าน ก ไม่ส่ง mem_code เลย → ใช้ร้านใน token',
    ownAddNoMem.status < 300,
    `HTTP ${ownAddNoMem.status}`,
  );
  const ownMine = await snapshot(t.a, shopA);
  check('ของเข้าตะกร้าร้าน ก จริง', ownMine.hasProduct, fmt(ownMine));
  const ownCheck = await call('POST', '/ecom/product-check-cart', t.a, {
    mem_code: shopA,
    pro_code: PRO_CODE,
    type: 'check',
  });
  const ownCheckAll = await call('POST', '/ecom/product-check-all-cart', t.a, {
    mem_code: shopA,
    type: 'check',
  });
  check(
    'ร้าน ก ติ๊ก / ติ๊กทั้งหมดในตะกร้าตัวเองได้',
    ownCheck.status < 300 && ownCheckAll.status < 300,
    `HTTP ${ownCheck.status}/${ownCheckAll.status}`,
  );
  const ownCount = await call(
    'GET',
    `/ecom/cart/count/${encodeURIComponent(shopA)}`,
    t.a,
  );
  check(
    'ร้าน ก นับของในตะกร้าตัวเองได้',
    ownCount.status === 200,
    `HTTP ${ownCount.status} → ${JSON.stringify(ownCount.body)}`,
  );
  const ownDel = await del(t.a, shopA);
  const ownAfterDel = await snapshot(t.a, shopA);
  check(
    'ร้าน ก ลบของในตะกร้าตัวเองได้',
    ownDel.status < 300 && !ownAfterDel.hasProduct,
    `HTTP ${ownDel.status} · ${fmt(ownAfterDel)}`,
  );

  // เก็บกวาด: ร้าน ข ลบสินค้าทดสอบของตัวเอง
  const cleanB = await del(t.b, shopB);
  const endB = await snapshot(t.b, shopB);
  check(
    'จบ: ร้าน ข ลบสินค้าทดสอบของตัวเองได้',
    cleanB.status < 300 && !endB.hasProduct,
    `HTTP ${cleanB.status} · ${fmt(endB)}`,
  );

  const passed = steps.filter((s) => s.result === 'ผ่าน').length;
  const failed = steps.filter((s) => s.result === 'ไม่ผ่าน').length;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `cart-own-shop-${E2E_ENV}-${stamp}.md`);
  writeFileSync(
    file,
    [
      `# E2E cart-own-shop (ECWC-750) — ${E2E_ENV}`,
      '',
      `- environment: **${E2E_ENV}**`,
      `- commit: \`${GIT_SHA}\``,
      `- เวลา: ${startedAt.toISOString()}`,
      `- BASE_URL: ${BASE_URL}`,
      `- ร้าน ก ${shopA} · ร้าน ข ${shopB} · สินค้า ${PRO_CODE} × 1 (ลบออกเมื่อจบ)`,
      `- ผล: **${passed} ผ่าน / ${failed} ไม่ผ่าน / ${steps.length - passed - failed} ข้าม**`,
      '',
      '| # | ขั้น | ผล | ที่เห็น |',
      '|---|---|---|---|',
      ...steps.map(
        (s, i) =>
          `| ${i + 1} | ${s.name} | ${s.result} | ${s.observed.replace(/\|/g, '\\|').slice(0, 300)} |`,
      ),
      '',
    ].join('\n'),
  );
  console.log(`\n${passed} passed, ${failed} failed → ${file}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
