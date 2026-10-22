/* eslint-disable no-console */
/**
 * E2E: ปุ่ม "สร้างโปสเตอร์" ของ Company Day เมื่อเปิด POSTER_ENGINE=craft (วาดด้วยบริการเทมเพลตแทน Ideogram)
 * ยิง API จริงแบบเดียวกับที่หน้า PosterConfigPage ยิง: generate-poster → get-response-id → เปิดภาพ → proxy-image
 *
 * ใช้:
 *   BASE_URL=http://localhost:3021/api npx ts-node scripts/e2e/craft-poster.e2e.ts
 *   BASE_URL=https://<api>/api E2E_ENV=dev|staging|prod npx ts-node scripts/e2e/craft-poster.e2e.ts
 *
 * E2E_ENV: ถ้า BASE_URL เป็น localhost จะเป็น "local" อัตโนมัติ ถ้าไม่ใช่ต้องระบุเอง ไม่งั้นสคริปต์ไม่รัน
 * ต้องการ: backend เปิด POSTER_ENGINE=craft และ CRAFT_RENDER_URL ชี้บริการเทมเพลต
 * ข้อมูลทดสอบ: ไม่เขียน DB (ไม่เรียก poster-history) โปสเตอร์ที่วาดอยู่ในที่เก็บของบริการเทมเพลต
 * ชื่อโปรโมชันขึ้นต้น "E2E <env>" ภาพสินค้าเป็น URL ภาพจริงในระบบสินค้า
 * ผลลัพธ์เขียนลง docs/e2e/craft-poster-<env>-<timestamp>.md
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3021/api').replace(
  /\/+$/,
  '',
);
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
const run = (cmd: string): string => {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
};
const GIT_SHA = run('git rev-parse --short HEAD') || 'unknown';
const GIT_DIRTY = run('git status --porcelain') !== '';

if (!E2E_ENV) {
  console.error(
    `BASE_URL=${BASE_URL} ไม่ใช่ localhost ต้องตั้ง E2E_ENV=dev|staging|prod ให้ชัดว่ายิงที่ไหน`,
  );
  process.exit(2);
}
if (E2E_ENV === 'local' && !IS_LOCAL) {
  console.error(`E2E_ENV=local แต่ BASE_URL=${BASE_URL} ไม่ใช่ localhost`);
  process.exit(2);
}

// สร้าง prompt แบบเดียวกับ promo-sheet-pro PosterConfigPage.tsx buildPrompt()
const promotionName = `E2E ${E2E_ENV} แฟงโก้`;
const gifts = [
  {
    name: 'กลูโคซาผง (รสส้ม)',
    quantity: 1,
    unit: 'กล่อง',
    url: 'https://www.wangpharma.com/cms/product/pro-img-1742116438.jpg',
  },
  { name: 'กระเป๋าผ้า', quantity: 2, unit: 'ใบ', url: '' }, // ของแถมที่ไม่มีภาพ: มีแค่ใน prompt
];
const purchases = [
  {
    name: 'แฟงโก้ ครีม 5ก.',
    url: 'https://www.wangpharma.com/cms/product/pro-img-1714018763.jpg',
  },
  {
    name: 'แอร์-เอ็กซ์ เอสเอฟ',
    url: 'https://wang-storage.sgp1.digitaloceanspaces.com/products/35040218/1791262467662_35040218',
  },
];
const prompt = [
  'สร้างโปสเตอร์โปรโมชั่นสไตล์โมเดิร์น ดีไซน์สดใส มีความเป็นมืออาชีพสูง',
  'ใช้โทนสีม่วง-ไวโอเล็ต gradient พรีเมียม หรูหรา พื้นหลัง gradient เรียบหรู มี geometric shapes หรือ abstract elements ประกอบเพื่อความ modern',
  'ตัวหนังสือต้องชัดเจน อ่านง่าย จัดวางสวยงาม ใช้ font หนา โดดเด่น',
  '',
  `ข้อความหลัก (แสดงขนาดใหญ่สุดด้านบน): "${promotionName} PROMOTION"`,
  'ระยะเวลาโปรโมชั่น: 1 ต.ค. 2569 – 31 ต.ค. 2569',
  `เงื่อนไข: "ซื้อสินค้ากลุ่ม ${promotionName} ครบ ${(5000).toLocaleString('th-TH')} บาท" — ตัวเลขจำนวนเงินต้องใหญ่และโดดเด่นมาก`,
  `สินค้าที่ซื้อ: ${purchases.map((p) => p.name).join(', ')} — แสดงภาพสินค้าเหล่านี้ในพื้นที่หลักของโปสเตอร์ให้โดดเด่น`,
  '',
  'ส่วนของแถม (FREE GIFT): แสดงแบนเนอร์ "ของแถม" หรือ "FREE GIFT" ชัดเจน',
  `รายการของแถม: ${gifts.map((g, i) => `${i + 1}. ${g.name} ${g.quantity} ${g.unit}`).join(', ')}`,
].join('\n');
const imageItems = [
  ...gifts.filter((g) => g.url).map((g) => ({ ...g, type: 'gift' })),
  ...purchases.map((p) => ({
    url: p.url,
    name: p.name,
    quantity: 0,
    unit: '',
    type: 'purchase',
  })),
];

const SIZES: Record<string, [number, number]> = {
  '1:1': [1080, 1080],
  '16:9': [1920, 1080],
  '9:16': [1080, 1920],
  '3:4': [1080, 1440],
};

type Check = { name: string; ok: boolean; detail: string };
const checks: Check[] = [];
const check = (name: string, ok: boolean, detail: string): void => {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
};

/** width x height of a PNG; the poster is exported at 2x */
const pngSize = (data: Buffer): [number, number] | null =>
  data.subarray(1, 4).toString() === 'PNG'
    ? [data.readUInt32BE(16), data.readUInt32BE(20)]
    : null;

async function generateAndPoll(aspectRatio: string): Promise<string | null> {
  const started = Date.now();
  const res = await axios.post(
    `${BASE_URL}/campaigns/generate-poster`,
    { prompt, aspectRatio, imageItems, session_cookies: '' },
    { validateStatus: () => true, timeout: 120_000 },
  );
  const requestId: string | undefined = res.data?.request_id;
  check(
    `generate-poster ${aspectRatio} คืน request_id`,
    res.status < 300 && !!requestId?.startsWith('craft-'),
    `HTTP ${res.status} ${requestId ?? JSON.stringify(res.data).slice(0, 120)} ใน ${Date.now() - started} ms`,
  );
  if (!requestId) return null;
  const poll = await axios.post(
    `${BASE_URL}/campaigns/get-response-id/${requestId}`,
    {},
    { validateStatus: () => true },
  );
  const url: string | undefined = poll.data?.url;
  check(
    `get-response-id ${aspectRatio} คืน url ทันที`,
    poll.status < 300 && !!url,
    `HTTP ${poll.status} ${url ?? JSON.stringify(poll.data)}`,
  );
  if (!url) return null;
  const image = await axios.get<ArrayBuffer>(url, {
    responseType: 'arraybuffer',
    validateStatus: () => true,
  });
  const size = pngSize(Buffer.from(image.data));
  const [w, h] = SIZES[aspectRatio];
  check(
    `ภาพ ${aspectRatio} เปิดได้และขนาดถูก`,
    image.status === 200 && !!size && size[0] === w * 2 && size[1] === h * 2,
    `HTTP ${image.status} ${size ? size.join('x') : 'ไม่ใช่ PNG'} (คาด ${w * 2}x${h * 2})`,
  );
  return url;
}

async function main(): Promise<void> {
  console.log(
    `E2E craft-poster env=${E2E_ENV} base=${BASE_URL} commit=${GIT_SHA}${GIT_DIRTY ? ' (มีการแก้ที่ยังไม่ commit)' : ''}`,
  );
  let firstUrl: string | null = null;
  for (const size of Object.keys(SIZES)) {
    const url = await generateAndPoll(size);
    firstUrl ??= url;
  }
  if (firstUrl) {
    const proxied = await axios.get<ArrayBuffer>(
      `${BASE_URL}/campaigns/proxy-image`,
      {
        params: { url: firstUrl },
        responseType: 'arraybuffer',
        validateStatus: () => true,
      },
    );
    check(
      'proxy-image ดาวน์โหลดโปสเตอร์ได้ (ปุ่มดาวน์โหลด)',
      proxied.status === 200 && !!pngSize(Buffer.from(proxied.data)),
      `HTTP ${proxied.status} ${String(proxied.headers['content-disposition'] ?? '')}`,
    );
    const base = firstUrl.slice(0, firstUrl.indexOf('/poster/'));
    const refused = await axios.get(`${BASE_URL}/campaigns/proxy-image`, {
      params: { url: `${base}/health` },
      validateStatus: () => true,
    });
    check(
      'proxy-image ไม่ยอมดึง URL อื่นบนบริการเทมเพลต',
      refused.status === 400,
      `HTTP ${refused.status}`,
    );
  }
  const bad = await axios.post(
    `${BASE_URL}/campaigns/get-response-id/craft-not-a-real-id`,
    {},
    { validateStatus: () => true },
  );
  check(
    'get-response-id ที่ id ผิดรูปไม่สร้าง url',
    !bad.data?.url,
    `HTTP ${bad.status} ${JSON.stringify(bad.data)}`,
  );

  const passed = checks.filter((c) => c.ok).length;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `craft-poster-${E2E_ENV}-${stamp}.md`);
  const lines = [
    `# E2E: Company Day poster ผ่านบริการเทมเพลต (${E2E_ENV})`,
    '',
    `- **Environment:** \`${E2E_ENV}\``,
    `- **API:** ${BASE_URL}`,
    `- **Commit:** ${GIT_SHA}${GIT_DIRTY ? ' + การแก้ที่ยังไม่ commit (branch feature/craft-poster-renderer)' : ''}`,
    `- **วันที่:** ${new Date().toISOString()}`,
    `- **ผล:** ${passed}/${checks.length} ผ่าน`,
    '- **ข้อมูลทดสอบ:** ไม่เขียน DB · ชื่อโปรโมชัน "' + promotionName + '"',
    '',
    '| Check | ผล | รายละเอียด |',
    '|---|---|---|',
    ...checks.map(
      (c) =>
        `| ${c.name} | ${c.ok ? 'ผ่าน' : '**ไม่ผ่าน**'} | ${c.detail.replace(/\|/g, '/')} |`,
    ),
  ];
  if (E2E_ENV === 'local')
    lines.push(
      '',
      'ผล `local` นับแค่ "ผ่านก่อน merge" ต้องรันซ้ำกับ deployed code หลัง deploy',
    );
  writeFileSync(file, lines.join('\n') + '\n');
  console.log(`${passed}/${checks.length} ผ่าน · รายงาน ${file}`);
  process.exit(passed === checks.length ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
