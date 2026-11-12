/**
 * E2E — ขั้นละเอียดในคลัง (picking_stage) ใน /ecom/internal/order-status/batch ที่ระบบขายใช้
 *   Tim 8 พ.ย. 2569: เซลส์ต้องแยกได้ว่า รอจัด / กำลังจัด / จัดเสร็จ รอ QC / กำลัง QC / QC ผ่าน
 *   ยิงจริง: e-commerce → order-picking (stage-batch) + ขนส่ง (batch-by-bill)
 *
 *   BASE_URL=http://localhost:3997/api INTERNAL_TOKEN=<x-internal-token> npx ts-node scripts/e2e/sales-picking-stage.e2e.ts
 *   E2E_ENV: ถ้า BASE_URL ไม่ใช่ localhost ต้องระบุเอง (dev / staging / prod) ไม่งั้นสคริปต์ไม่รัน
 *
 * ข้อมูล "E2E <env>" ต้อง seed ที่ order-picking ก่อนรัน (ร้าน E2E-PS1 ส่งรถ / E2E-PS2 รับเอง, บิล E2E-PS-*)
 *   และในขนส่งให้ E2E-PS-DLV อยู่ระหว่างส่ง · ล้างหลังรัน — สคริปต์นี้อ่านอย่างเดียว ไม่สร้าง/แก้ข้อมูล
 * รายงาน → docs/e2e/sales-picking-stage-<env>-<timestamp>.md
 */
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const TOKEN = process.env.INTERNAL_TOKEN ?? '';
if (!['local', 'dev', 'staging', 'prod'].includes(E2E_ENV) || !TOKEN) {
  console.error('ต้องตั้ง INTERNAL_TOKEN และ E2E_ENV (ถ้าไม่ใช่ localhost)');
  process.exit(2);
}

// [บิล, ร้าน, status ชุดเดิม (หน้าลูกค้า), picking_stage ที่ต้องได้]
const BILLS: [string, string, string, string | null][] = [
  ['E2E-PS-OPEN', 'E2E-PS1', 'opened', null],
  ['E2E-PS-WAIT', 'E2E-PS1', 'picking', 'waiting_pick'],
  ['E2E-PS-PICK', 'E2E-PS1', 'picking', 'picking'],
  ['E2E-PS-DONE', 'E2E-PS1', 'checking', 'picked'],
  ['E2E-PS-QC', 'E2E-PS1', 'checking', 'qc'],
  ['E2E-PS-RDY', 'E2E-PS1', 'waiting_load', 'ready'],
  ['E2E-PS-DLV', 'E2E-PS1', 'delivering', null],
  ['E2E-PS-BLK', 'E2E-PS1', 'blocked', null],
  ['E2E-PS-PU', 'E2E-PS2', 'waiting_load', 'ready'],
];

const results: { name: string; ok: boolean; detail: string }[] = [];
const check = (name: string, ok: boolean, detail: string) => {
  results.push({ name, ok, detail });
  console.error(`${ok ? 'PASS' : 'FAIL'}  ${name} — ${detail}`);
};

type Row = {
  sh_running: string;
  mem_code: string;
  status: string;
  status_label: string;
  picking_stage?: string | null;
};
const post = async (token: string) => {
  const res = await fetch(`${BASE_URL}/ecom/internal/order-status/batch`, {
    method: 'POST',
    headers: { 'x-internal-token': token, 'content-type': 'application/json' },
    body: JSON.stringify({
      items: BILLS.map(([sh_running, mem_code]) => ({ sh_running, mem_code })),
    }),
  });
  return {
    status: res.status,
    rows: res.ok ? ((await res.json()) as Row[]) : [],
  };
};

async function main() {
  const denied = await post('wrong-token');
  check(
    'ไม่มี/ผิด internal token → ปฏิเสธ',
    denied.status === 401 || denied.status === 403,
    `HTTP ${denied.status}`,
  );

  const { status, rows } = await post(TOKEN);
  const by = new Map(rows.map((r) => [r.sh_running, r]));
  const wrongStage = BILLS.filter(
    ([so, , , stage]) => (by.get(so)?.picking_stage ?? null) !== stage,
  ).map(([so, , , stage]) => `${so}=${by.get(so)?.picking_stage}≠${stage}`);
  check(
    'picking_stage ต่อบิลตรงขั้นในคลัง (รอจัด/กำลังจัด/จัดเสร็จ/กำลัง QC/QC ผ่าน) · ถึงขนส่ง/บล็อก/ยังไม่ถึงคลัง = null',
    status === 201 && rows.length === BILLS.length && wrongStage.length === 0,
    `HTTP ${status} · ${rows.length} บิล${wrongStage.length ? ' · ผิด ' + wrongStage.join(', ') : ' · ตรงทุกบิล'}`,
  );
  const wrongStatus = BILLS.filter(
    ([so, , st]) => by.get(so)?.status !== st,
  ).map(([so, , st]) => `${so}=${by.get(so)?.status}≠${st}`);
  check(
    'status ชุดเดิมของหน้าลูกค้าไม่เปลี่ยนความหมาย · หยิบเสร็จแล้วได้ checking (เดิมไม่เคยขึ้น)',
    wrongStatus.length === 0,
    wrongStatus.length ? wrongStatus.join(', ') : 'ตรงทุกบิล',
  );

  const commit = execSync('git rev-parse --short HEAD').toString().trim();
  const stamp = new Date(Date.now() + 7 * 3600e3)
    .toISOString()
    .slice(0, 16)
    .replace(/[-:]/g, '')
    .replace('T', '-');
  const pass = results.filter((r) => r.ok).length;
  mkdirSync('docs/e2e', { recursive: true });
  const out = `docs/e2e/sales-picking-stage-${E2E_ENV}-${stamp}.md`;
  writeFileSync(
    out,
    `# E2E — ขั้นละเอียดในคลังให้ระบบขาย (picking_stage)

- **environment:** \`${E2E_ENV}\`${E2E_ENV === 'local' ? ' (ผ่านก่อน merge เท่านั้น — ต้องรันซ้ำกับ deployed code)' : ''}
- **commit:** \`${commit}\` · **base:** ${BASE_URL}

## ผล ${pass}/${results.length}

| | ขั้น | ที่เห็น |
|---|---|---|
${results.map((r) => `| ${r.ok ? 'PASS' : 'FAIL'} | ${r.name} | ${r.detail.replace(/\|/g, '\\|')} |`).join('\n')}
`,
  );
  console.error(`\n${pass}/${results.length} → ${out}`);
  process.exit(pass === results.length ? 0 : 1);
}

void main();
