/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
/**
 * สร้าง/ล้างข้อมูลตัวอย่างสำหรับ "สาธิต" ฟีเจอร์พรีออเดอร์ (ไม่ใช่ e2e)
 *
 * ใช้เตรียมเวทีสาธิตหรือ UAT ให้เหมือนกันทุกเครื่อง/ทุก environment โดยยิง admin API จริง
 * ไม่แตะ DB ตรง จึงได้ผลเดียวกับที่แอดมินกดเองในหน้าเว็บ
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api ADMIN_TOKEN=<jwt admin> \
 *     npx ts-node scripts/demo/preorder-demo.ts up|status|down
 *
 * env:
 *   BASE_URL     ปลายทาง API (ลงท้าย /api)
 *   ADMIN_TOKEN  token ของบัญชีแอดมิน (permission=true) ของ environment นั้น
 *   DEMO_ENV     ป้าย environment (local/dev/staging/prod) localhost เดาให้เป็น local
 *   PRO_S1/2/3   (ไม่บังคับ) รหัสสินค้าที่จะใช้ ถ้าไม่ระบุใช้ค่า default ด้านล่าง
 *                ทุกตัว "ต้องสต็อกเป็น 0" เพราะพรีออเดอร์ใช้กับของขาดเท่านั้น (มติ 9 ก.ย. 69)
 *
 * คำสั่ง:
 *   up      สร้าง 2 รอบสาธิต (ของขาดจัดสรร / สั่งผลิตตามยอด+ปรับราคา) แล้วเปิดรับจอง
 *   status  แสดงรอบสาธิตที่มีอยู่ พร้อมจำนวนรายการจอง
 *   down    ยกเลิกรอบสาธิตทั้งหมดของ environment นี้ (ข้อมูลยังอยู่ใน DB สถานะ cancelled)
 *
 * ชื่อรอบขึ้นต้น "DEMO <env> ·" เสมอ เพื่อให้แยกออกจากรอบจริงและกวาดทิ้งได้
 */
import axios, { AxiosInstance } from 'axios';

interface DemoCampaign {
  id: number;
  name: string;
  status: string;
}
interface DemoProduct {
  id: number;
  pro_code: string;
  pro_name?: string | null;
  reason?: string;
}

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3021/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const DEMO_ENV = process.env.DEMO_ENV ?? (IS_LOCAL ? 'local' : '');
const CMD = (process.argv[2] ?? 'status').toLowerCase();

/** สินค้าตัวอย่าง 3 ตัว ต้องสต็อก 0 ทั้งหมด (default = ชุดที่ใช้ซ้อมบนเครื่อง dev) */
const S1 = process.env.PRO_S1 ?? '73051105'; // ของขาด โหมดจัดสรร
const S2 = process.env.PRO_S2 ?? '85100209'; // สั่งผลิตตามยอด MOQ + ราคาขั้นบันได
const S3 = process.env.PRO_S3 ?? '03031208'; // ขาดสต็อก + ผู้ผลิตแจ้งปรับราคา

if (!ADMIN_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN (token แอดมินของ environment ที่จะยิง)');
  process.exit(2);
}
if (!DEMO_ENV) {
  console.error(
    `BASE_URL=${BASE_URL} ไม่ใช่ localhost ต้องตั้ง DEMO_ENV=dev|staging|prod ให้ชัดว่าสร้างที่ไหน`,
  );
  process.exit(2);
}
if (!['up', 'down', 'status'].includes(CMD)) {
  console.error(`คำสั่งไม่ถูกต้อง: ${CMD} (ใช้ up | status | down)`);
  process.exit(2);
}

const PREFIX = `DEMO ${DEMO_ENV} ·`;

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
  validateStatus: () => true,
  timeout: 20000,
});

const days = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function fail(what: string, res: { status: number; data: unknown }): never {
  const body = res.data as { message?: unknown } | null;
  const msg =
    typeof body?.message === 'string'
      ? body.message
      : JSON.stringify(res.data ?? {}).slice(0, 300);
  console.error(`✗ ${what} → HTTP ${res.status} ${msg}`);
  process.exit(1);
}

/** ตรวจว่าสินค้ามีจริง มีหน่วย และสต็อกเป็น 0 ก่อนเอาเข้ารอบ */
async function checkProduct(code: string, label: string): Promise<void> {
  const r = await api.get('/ecom/admin/preorder/product-lookup', {
    params: { q: code },
  });
  if (r.status !== 200) fail(`หาสินค้า ${label} (${code})`, r);
  const p = r.data ?? {};
  const stock = Number(p.pro_stock ?? 0);
  console.log(
    `  ${label} ${code} — ${String(p.pro_name ?? '?').slice(0, 30)} · หน่วย ${p.unit ?? '?'} · สต็อก ${stock}`,
  );
  if (!p.unit) {
    console.error(
      `✗ สินค้า ${code} ไม่มีหน่วย เลือกสินค้าตัวอื่นผ่าน PRO_S1/2/3`,
    );
    process.exit(1);
  }
  if (stock > 0) {
    console.warn(
      `  ⚠ สินค้า ${code} ยังมีสต็อก ${stock} — พรีออเดอร์ใช้กับของขาดเท่านั้น หน้าแอดมินจะขึ้นป้ายเตือน`,
    );
  }
}

async function createCampaign(body: Record<string, unknown>): Promise<number> {
  const r = await api.post('/ecom/admin/preorder/campaigns', body);
  if (r.status !== 201 && r.status !== 200)
    fail(`สร้างรอบ ${String(body.name)}`, r);
  return Number(r.data.id);
}

async function addProduct(
  campaignId: number,
  body: Record<string, unknown>,
): Promise<number> {
  const r = await api.post(
    `/ecom/admin/preorder/campaigns/${campaignId}/products`,
    body,
  );
  if (r.status !== 201 && r.status !== 200)
    fail(`เพิ่มสินค้า ${String(body.pro_code)} เข้ารอบ ${campaignId}`, r);
  return Number(r.data.id);
}

async function setStatus(campaignId: number, status: string): Promise<void> {
  const r = await api.patch(
    `/ecom/admin/preorder/campaigns/${campaignId}/status`,
    { status },
  );
  if (r.status !== 200) fail(`เปลี่ยนสถานะรอบ ${campaignId} เป็น ${status}`, r);
}

async function listDemoCampaigns(): Promise<DemoCampaign[]> {
  const r = await api.get('/ecom/admin/preorder/campaigns');
  if (r.status !== 200) fail('ดึงรายการรอบ', r);
  const all = (r.data ?? []) as DemoCampaign[];
  return all.filter((c) => String(c.name).startsWith(PREFIX));
}

async function up(): Promise<void> {
  console.log(`สร้างข้อมูลสาธิตที่ ${BASE_URL} (env=${DEMO_ENV})`);
  const existing = await listDemoCampaigns();
  const live = existing.filter((c) => c.status !== 'cancelled');
  if (live.length) {
    console.error(
      `✗ มีรอบสาธิตค้างอยู่แล้ว ${live.length} รอบ (id ${live.map((c) => c.id).join(', ')}) — รัน down ก่อน`,
    );
    process.exit(1);
  }

  console.log('ตรวจสินค้าตัวอย่าง');
  await checkProduct(S1, 'S1');
  await checkProduct(S2, 'S2');
  await checkProduct(S3, 'S3');

  // ---------- รอบ A: ของขาด จัดสรรตามคิว ----------
  const a = await createCampaign({
    name: `${PREFIX} สินค้าขาดตลาด รอบสาธิต`,
    mode: 'allocation',
    ends_at: `${days(14)}T23:59:59.000Z`,
    detail_announcement:
      'สินค้าขาดตลาด ทางบริษัทได้รับจัดสรรจำนวนจำกัด จึงเปิดให้ร้านค้าแจ้งความจำนงล่วงหน้า และจะจัดสรรตามลำดับการจองค่ะ',
    breaking_announcement: 'ของมีจำนวนจำกัด ขออภัยหากได้ไม่ครบตามที่แจ้งไว้',
    terms:
      'รายการที่จองในรอบนี้ยกเลิกเองไม่ได้ หากต้องการแก้ไขกรุณาติดต่อเซลล์ที่ดูแลร้านของท่าน',
    allow_cancel: false,
    increase_policy: 'split',
    increase_grace_hours: 1,
  });
  await addProduct(a, {
    pro_code: S1,
    reason: 'restock',
    limit_per_member: 5,
    supply_qty: 8,
    eta_date: days(10),
    note: 'ของเข้าประมาณ 10 วัน จัดสรรตามลำดับการจอง',
  });
  await setStatus(a, 'open');
  console.log(
    `✓ รอบ A (ของขาด จัดสรร) id=${a} · สินค้า ${S1} limit 5 supply 8`,
  );

  // ---------- รอบ B: รวบรวมยอดสั่งผู้ผลิต + กรณีปรับราคา ----------
  const b = await createCampaign({
    name: `${PREFIX} สั่งผลิตล่วงหน้า รอบสาธิต`,
    mode: 'aggregation',
    ends_at: `${days(21)}T23:59:59.000Z`,
    detail_announcement:
      'รอบรวบรวมยอดสั่งผลิต เมื่อยอดรวมถึงขั้นต่ำที่ผู้ผลิตกำหนด ทางบริษัทจะสั่งผลิตและแจ้งกำหนดของเข้าให้ทราบค่ะ',
    allow_cancel: true,
    increase_policy: 'keep',
  });
  await addProduct(b, {
    pro_code: S2,
    reason: 'restock',
    moq: 10,
    estimated_price: 90,
    price_tiers: [
      { min_total_qty: 30, price: 88 },
      { min_total_qty: 60, price: 85 },
    ],
    eta_date: days(21),
    note: 'ยอดรวมยิ่งมาก ราคาต่อหน่วยยิ่งลด',
  });
  await addProduct(b, {
    pro_code: S3,
    reason: 'price_increase',
    new_price: 129,
    price_effective_date: days(21),
    min_per_member: 2,
    pack_multiple: 2,
    eta_date: days(14),
    note: 'ผู้ผลิตแจ้งปรับราคา เปิดจองล่วงหน้าเพื่อความโปร่งใส',
    // price_type: ตั้งใจเว้นว่าง ให้ผู้สาธิตเลือกสดในฟอร์ม (6 แบบตามนิยามผู้บริหาร)
  });
  await setStatus(b, 'open');
  console.log(
    `✓ รอบ B (สั่งผลิตตามยอด) id=${b} · สินค้า ${S2} MOQ 10 ขั้นบันได 30→88 / 60→85 · ${S3} ปรับราคาเป็น 129 ขั้นต่ำ 2 หีบห่อ 2`,
  );

  console.log('\nเปิดรับจองแล้วทั้ง 2 รอบ');
  console.log(
    'อย่าลืมเปิด feature flag `preorder` ไม่งั้นลูกค้าจะไม่เห็นเมนู (หน้าแอดมิน → Feature Flags)',
  );
  console.log(
    `ล้างข้อมูลเมื่อจบ: DEMO_ENV=${DEMO_ENV} ... preorder-demo.ts down`,
  );
}

async function status(): Promise<void> {
  const cs = await listDemoCampaigns();
  if (!cs.length) {
    console.log(`ไม่มีรอบสาธิตของ env=${DEMO_ENV} (ขึ้นต้น "${PREFIX}")`);
    return;
  }
  for (const c of cs) {
    const d = await api.get(`/ecom/admin/preorder/campaigns/${c.id}`);
    const products: DemoProduct[] =
      d.status === 200
        ? ((d.data as { products?: DemoProduct[] }).products ?? [])
        : [];
    console.log(
      `#${c.id} [${c.status}] ${c.name} — สินค้า ${products.length} รายการ`,
    );
    for (const p of products) {
      const q = await api.get(`/ecom/admin/preorder/products/${p.id}/queue`);
      const qd = (q.status === 200 ? q.data : {}) as {
        items?: unknown[];
        total_qty?: number;
        total_members?: number;
      };
      const lots = qd.items?.length ?? 0;
      const qty = qd.total_qty ?? 0;
      const members = qd.total_members ?? 0;
      console.log(
        `    ${p.pro_code} ${String(p.pro_name ?? '').slice(0, 24)} · reason=${p.reason} · ${members} ร้าน ${qty} หน่วย (${lots} ล็อต)`,
      );
    }
  }
}

async function down(): Promise<void> {
  const cs = (await listDemoCampaigns()).filter(
    (c) => c.status !== 'cancelled',
  );
  if (!cs.length) {
    console.log(`ไม่มีรอบสาธิตที่ยังเปิดอยู่ใน env=${DEMO_ENV}`);
    return;
  }
  for (const c of cs) {
    await setStatus(c.id, 'cancelled');
    console.log(`✓ ยกเลิกรอบ #${c.id} ${c.name}`);
  }
}

async function main(): Promise<void> {
  if (CMD === 'up') await up();
  else if (CMD === 'down') await down();
  else await status();
}

void main().catch((e: unknown) => {
  console.error('ผิดพลาด:', e instanceof Error ? e.message : String(e));
  process.exit(1);
});
