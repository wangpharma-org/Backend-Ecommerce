/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * E2E: สินค้าของแถม (ชื่อขึ้นต้น FREE/ หรือมี /ฟรี) ต้องไม่โผล่ในผลค้นหาและหน้าหมวดหมู่ (PR #320)
 * ยิง API ที่รันอยู่จริง — อ่านอย่างเดียว (การค้นหาบันทึก search tracking ตามปกติของ endpoint)
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod USER_TOKEN=<jwt ร้านทดสอบ> \
 *   npx ts-node scripts/e2e/hide-free-gift-search.e2e.ts
 *
 * ตัวเลือก:
 *   FREE_PRO_CODE=<รหัสสินค้าของแถมที่มีใน DB> → ค้นด้วยรหัสตรง ๆ ต้องไม่เจอ
 *   CATEGORY=<เลขหมวดหมู่ที่มีสินค้าของแถมอยู่> → หน้าหมวดหมู่ต้องไม่มีของแถม
 *     (ต้องมีของแถมในหมวดนั้นจริง ไม่งั้นผ่านแบบไม่มีความหมาย — สคริปต์บอกในรายงาน)
 *   CONTROL_KEYWORD=<คำค้นที่ต้องเจอสินค้าปกติ> (ค่าเริ่มต้น "พารา") → ยืนยันว่าการค้นหายังทำงาน
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ไม่งั้นต้องระบุเอง
 * ค่าลับส่งทาง env เท่านั้น · ผลเขียนลง docs/e2e/hide-free-gift-search-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { isSlashFreeGiftName } from '../../src/products/free-gift-name.util';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const FREE_PRO_CODE = process.env.FREE_PRO_CODE ?? '';
const CATEGORY = process.env.CATEGORY ? Number(process.env.CATEGORY) : NaN;
const CONTROL_KEYWORD = process.env.CONTROL_KEYWORD ?? 'พารา';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');

if (!USER_TOKEN || !E2E_ENV) {
  console.error(
    'ต้องตั้ง USER_TOKEN และ E2E_ENV เมื่อ BASE_URL ไม่ใช่ localhost',
  );
  process.exit(2);
}

const http = axios.create({
  baseURL: BASE_URL,
  validateStatus: () => true,
  headers: { Authorization: `Bearer ${USER_TOKEN}` },
});

type Step = {
  name: string;
  result: 'ผ่าน' | 'ไม่ผ่าน' | 'ข้าม';
  observed: string;
};
const steps: Step[] = [];
const check = (name: string, pass: boolean, observed: string) => {
  steps.push({ name, result: pass ? 'ผ่าน' : 'ไม่ผ่าน', observed });
  console.error(`${pass ? 'PASS' : 'FAIL'}  ${name} — ${observed}`);
};
const skip = (name: string, why: string) => {
  steps.push({ name, result: 'ข้าม', observed: why });
  console.error(`SKIP  ${name} — ${why}`);
};

type Product = { pro_code: string; pro_name: string | null };
// ECWC-751: /ฟรีไซส์, /ฟรี1ชิ้น เป็นสินค้าขาย ไม่ใช่ของแถม — ใช้กฎเดียวกับ backend
const isFreeGift = (p: Product) =>
  /^FREE\//i.test(p.pro_name ?? '') || isSlashFreeGiftName(p.pro_name);
const freeIn = (products: Product[]) =>
  products.filter(isFreeGift).map((p) => p.pro_code);

const search = (keyword: string) =>
  http.post('/ecom/search-products', { keyword, offset: 0, limit: 50 });
const category = (cat: number, keyword: string) =>
  http.post('/ecom/category-products', {
    keyword,
    category: cat,
    offset: 0,
    limit: 200,
  });

async function main() {
  const control = await search(CONTROL_KEYWORD);
  const controlProducts: Product[] = control.data?.products ?? [];
  check(
    `ค้นหาปกติยังทำงาน ("${CONTROL_KEYWORD}" เจอสินค้า)`,
    control.status === 201 && controlProducts.length > 0,
    `HTTP ${control.status} · ${controlProducts.length} รายการ`,
  );

  for (const keyword of ['FREE/', 'FREE', 'ฟรี']) {
    const r = await search(keyword);
    const products: Product[] = r.data?.products ?? [];
    const leaked = freeIn(products);
    check(
      `ค้นหา "${keyword}" → ไม่มีสินค้าของแถม`,
      r.status === 201 && leaked.length === 0,
      `HTTP ${r.status} · ${products.length} รายการ · ของแถมหลุด ${leaked.length}${leaked.length ? ` (${leaked.slice(0, 5).join(', ')})` : ''}`,
    );
  }

  const byCode = `ค้นด้วยรหัสสินค้าของแถมตรง ๆ → ไม่เจอ`;
  if (!FREE_PRO_CODE) skip(byCode, 'ไม่ได้ตั้ง FREE_PRO_CODE');
  else {
    const r = await search(FREE_PRO_CODE);
    const products: Product[] = r.data?.products ?? [];
    const hit = products.filter((p) => p.pro_code === FREE_PRO_CODE);
    check(
      `${byCode} (${FREE_PRO_CODE})`,
      r.status === 201 && hit.length === 0 && freeIn(products).length === 0,
      `HTTP ${r.status} · ${products.length} รายการ · เจอรหัสนี้ ${hit.length}`,
    );
  }

  const catStep = 'หน้าหมวดหมู่ → ไม่มีสินค้าของแถม';
  if (!Number.isInteger(CATEGORY)) skip(catStep, 'ไม่ได้ตั้ง CATEGORY');
  else {
    const r = await category(CATEGORY, '');
    const products: Product[] = r.data?.products ?? [];
    const leaked = freeIn(products);
    check(
      `${catStep} (หมวด ${CATEGORY})`,
      r.status === 201 && leaked.length === 0,
      `HTTP ${r.status} · ${products.length} รายการ (totalCount=${r.data?.totalCount ?? '-'}) · ของแถมหลุด ${leaked.length}`,
    );
    const r2 = await category(CATEGORY, 'FREE');
    const products2: Product[] = r2.data?.products ?? [];
    check(
      `${catStep} (หมวด ${CATEGORY} + คำค้น "FREE")`,
      r2.status === 201 && freeIn(products2).length === 0,
      `HTTP ${r2.status} · ${products2.length} รายการ · ของแถมหลุด ${freeIn(products2).length}`,
    );
  }
}

function writeReport(failure?: string): boolean {
  let commit = 'unknown';
  try {
    commit = execSync('git rev-parse --short HEAD', {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim();
    if (
      execSync('git status --porcelain -- src', {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
        .toString()
        .trim()
    ) {
      commit += ' + แก้ไขที่ยังไม่ commit';
    }
  } catch {
    /* รันนอก git ได้ */
  }
  const failed = steps.filter((s) => s.result === 'ไม่ผ่าน').length;
  const skipped = steps.filter((s) => s.result === 'ข้าม').length;
  const ok = !failure && failed === 0 && steps.length > skipped;
  const stamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, '');
  const lines = [
    '# E2E — ซ่อนสินค้าของแถม FREE/* และ */ฟรี* จากผลค้นหาและหมวดหมู่',
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **Base URL:** ${BASE_URL}`,
    `- **Commit ที่ทดสอบ:** ${commit}`,
    `- **เวลา (UTC):** ${new Date().toISOString()}`,
    `- **ข้อมูลทดสอบ:** อ่านอย่างเดียว${FREE_PRO_CODE ? ` · ของแถม \`${FREE_PRO_CODE}\`` : ''}${Number.isInteger(CATEGORY) ? ` · หมวด ${CATEGORY}` : ''}`,
    `- **ผลรวม:** ${ok ? 'ผ่าน' : 'ไม่ผ่าน'} — ${steps.length - failed - skipped}/${steps.length} ขั้นผ่าน${skipped ? `, ข้าม ${skipped}` : ''}`,
    ...(E2E_ENV === 'local'
      ? [
          '- **หมายเหตุ:** ผล `local` นับแค่ "ผ่านก่อน merge" ต้องรันซ้ำกับ deployed code หลัง deploy',
        ]
      : []),
    '',
    '| ขั้น | ผล | สิ่งที่ได้ |',
    '|---|---|---|',
    ...steps.map(
      (s) =>
        `| ${s.name} | ${s.result} | ${s.observed.replace(/\|/g, '\\|')} |`,
    ),
    ...(failure ? ['', `สคริปต์หยุดกลางทาง: ${failure}`] : []),
    '',
  ];
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const name = `hide-free-gift-search-${E2E_ENV}-${stamp}.md`;
  writeFileSync(join(dir, name), lines.join('\n'));
  console.error(`รายงาน: docs/e2e/${name}`);
  return ok;
}

void main()
  .then(() => undefined)
  .catch((e: unknown) => {
    const failure = e instanceof Error ? e.message : String(e);
    console.error(`หยุดกลางทาง: ${failure}`);
    return failure;
  })
  .then((failure) => process.exit(writeReport(failure) ? 0 : 1));
