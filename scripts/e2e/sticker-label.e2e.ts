/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any */
/**
 * E2E: สติ๊กเกอร์ฉลากยา แบบพิมพ์หัวร้าน (ECWC-697: 698 + 699 + 702 + 704 PDF) ยิง API จริง
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod ADMIN_TOKEN=<jwt admin> USER_TOKEN=<jwt ลูกค้า> \
 *   npx ts-node scripts/e2e/sticker-label.e2e.ts
 *
 * เงื่อนไขก่อนรัน
 * - มีสินค้า 95030411-05 / 95030411-07 ในตาราง product พร้อมหน่วย ดวง(1) / ม500ดวง(500) และราคา > 0
 * - server ตั้ง STICKER_LABEL_ENABLED_LANGS=th,en,zh,ru,ar,my
 *   และ STICKER_PRINTERS ที่มีเครื่องขาวดำ id=e2e-bw (color=false) และเครื่องสี id=e2e-color (color=true)
 * - ตะกร้าของร้าน USER_TOKEN ต้องว่าง (สคริปต์สั่งซื้อจริงจากตะกร้า)
 * - feature flag sticker_label ปิดอยู่ (สคริปต์เปิดเองแล้วปิดคืนเมื่อจบ)
 *
 * ข้อมูลทดสอบ: ชื่อร้านขึ้นต้น "E2E <env>" · ออเดอร์ทดสอบที่สร้างจะยังอยู่ใน DB (ระบุเลขในรายงาน)
 * ผลลัพธ์เขียนลง docs/e2e/sticker-label-<env>-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const USER_TOKEN = process.env.USER_TOKEN ?? '';
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE_URL);
const E2E_ENV = process.env.E2E_ENV ?? (IS_LOCAL ? 'local' : '');
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

if (!ADMIN_TOKEN || !USER_TOKEN) {
  console.error('ต้องตั้ง ADMIN_TOKEN, USER_TOKEN');
  process.exit(2);
}
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

const BW = '95030411-05';
const COLOR = '95030411-07';

const client = (token: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    validateStatus: () => true,
    timeout: 30000,
  });
const admin = client(ADMIN_TOKEN);
const user = client(USER_TOKEN);

interface StepResult {
  step: string;
  ok: boolean;
  status?: number;
  detail?: string;
}
const results: StepResult[] = [];

async function step(
  name: string,
  fn: () => Promise<{ status: number; ok: boolean; detail?: string }>,
) {
  try {
    const r = await fn();
    results.push({ step: name, ok: r.ok, status: r.status, detail: r.detail });
    console.log(
      `${r.ok ? 'PASS' : 'FAIL'}  ${name}  [${r.status}] ${r.detail ?? ''}`,
    );
  } catch (e) {
    const err = e as AxiosError;
    results.push({ step: name, ok: false, detail: err.message });
    console.log(`FAIL  ${name}  ${err.message}`);
  }
}

function decodeJwt(token: string): {
  mem_code?: string;
  username?: string;
  permission?: boolean;
} {
  try {
    const part = token.split('.')[1] ?? '';
    return JSON.parse(
      Buffer.from(
        part.replace(/-/g, '+').replace(/_/g, '/'),
        'base64',
      ).toString('utf8'),
    );
  } catch {
    return {};
  }
}

/** แถวสติ๊กเกอร์ทั้งหมดในตะกร้า (ทุก group) */
function stickerRows(cart: any[]): any[] {
  return (cart ?? [])
    .filter((g) => g.pro_code === BW || g.pro_code === COLOR)
    .flatMap((g) => g.shopping_cart ?? [])
    .filter((row) => row.custom_options);
}

async function main() {
  const adminJwt = decodeJwt(ADMIN_TOKEN);
  const userJwt = decodeJwt(USER_TOKEN);
  if (adminJwt.permission !== true || userJwt.permission === true) {
    console.error(
      'ADMIN_TOKEN ต้อง permission=true และ USER_TOKEN ต้องเป็นร้านธรรมดา',
    );
    process.exit(2);
  }
  const memCode = userJwt.mem_code ?? '';
  const tag = `E2E ${E2E_ENV}`;
  console.log(
    `env=${E2E_ENV}  base=${BASE_URL}  commit=${GIT_SHA}  admin=${adminJwt.mem_code}  user=${memCode}`,
  );

  const design = (over: Record<string, unknown> = {}) => ({
    shopName: `${tag} ร้านยาทดสอบ`,
    address: '123 ถ.ทดสอบ ต.ในเมือง อ.เมือง',
    line3: 'เปิด 08:00-20:00 โทร 02-000-0000',
    lang: 'th',
    printMode: 'bw',
    packSize: '1',
    ...over,
  });
  let cartVersion: string | number | undefined;
  const addSticker = async (custom_options: unknown, packs: unknown) => {
    const r = await user.post('/ecom/sticker-label/cart', {
      custom_options,
      packs,
      clientVersion: cartVersion,
    });
    if (r.data?.cartVersion != null) cartVersion = r.data.cartVersion;
    return r;
  };

  // ---------------- ECWC-698 ตัวเลือก + feature flag ----------------

  await step('flag ปิด → config ต้อง 403', async () => {
    const r = await user.get('/ecom/sticker-label/config');
    return { status: r.status, ok: r.status === 403 };
  });

  await step('admin เปิด flag sticker_label', async () => {
    const r = await admin.post('/ecom/feature-flag/update-flag', {
      flag: 'sticker_label',
      status: true,
    });
    return { status: r.status, ok: r.status < 300 };
  });

  await step(
    'config คืน 2 mode map รหัส -05/-07 + 2 ขนาดบรรจุ + 6 ภาษา',
    async () => {
      const r = await user.get('/ecom/sticker-label/config');
      const modes = r.data?.printModes ?? [];
      const bw = modes.find((m: any) => m.mode === 'bw');
      const color = modes.find((m: any) => m.mode === 'color');
      const ok =
        r.status === 200 &&
        bw?.pro_code === BW &&
        color?.pro_code === COLOR &&
        bw?.available === true &&
        color?.available === true &&
        bw.packs
          .map((p: any) => `${p.packSize}:${p.sheets}:${p.dots}`)
          .join() === '1:1:10,50:50:500' &&
        bw.packs[1].price === Math.round(bw.price_per_dot * 500 * 100) / 100 &&
        (r.data?.langs ?? []).join() === 'th,en,zh,ru,ar,my' &&
        r.data?.maxLength?.shopName === 40 &&
        r.data?.maxLength?.address === 55 &&
        r.data?.maxLength?.line3 === 40 &&
        (r.data?.fonts ?? []).join() ===
          'sarabun,prompt,kanit,mitr,trirong,charm';
      return {
        status: r.status,
        ok,
        detail: `bw/แผ่น=${bw?.packs?.[0]?.price} bw/50แผ่น=${bw?.packs?.[1]?.price}`,
      };
    },
  );

  await step(
    'เพิ่มสติ๊กเกอร์ผ่าน add-cart ปกติ (ไม่มีรูปแบบ) → 400',
    async () => {
      const r = await user.post('/ecom/product-add-cart', {
        mem_code: memCode,
        pro_code: BW,
        pro_unit: 'ดวง',
        amount: 10,
      });
      return { status: r.status, ok: r.status === 400 };
    },
  );

  // ---------------- ECWC-699 ตะกร้า ----------------

  // ร้านที่ไม่เคยสั่งได้ null · ถ้ารันซ้ำกับร้านเดิมจะได้รูปแบบจากรอบก่อน
  await step('last-options ก่อนสั่งรอบนี้ → null หรือรูปแบบเดิม', async () => {
    const r = await user.get('/ecom/sticker-label/last-options');
    const o = r.data?.custom_options;
    return {
      status: r.status,
      ok: r.status === 200 && (o === null || typeof o?.shopName === 'string'),
      detail:
        o === null ? 'null (ไม่เคยสั่ง)' : `มีออเดอร์เดิม: ${o?.shopName}`,
    };
  });

  const validations: [string, unknown, unknown][] = [
    ['ไม่มีชื่อร้าน', design({ shopName: '  ' }), 1],
    ['ชื่อร้าน 41 ตัวอักษร', design({ shopName: 'ก'.repeat(41) }), 1],
    ['ที่อยู่ 56 ตัวอักษร', design({ address: 'ก'.repeat(56) }), 1],
    ['บรรทัด 3 41 ตัวอักษร', design({ line3: 'ก'.repeat(41) }), 1],
    ['mode สีไม่มี hex', design({ printMode: 'color' }), 1],
    ['mode สี hex ผิด', design({ printMode: 'color', color: 'red' }), 1],
    ['ภาษาไม่รองรับ', design({ lang: 'jp' }), 1],
    ['packSize ไม่รองรับ', design({ packSize: '10' }), 1],
    ['packs = 0', design(), 0],
    ['packs = "2a"', design(), '2a'],
    ['2 ภาษาแต่ภาษาหลักไม่ใช่ไทย', design({ lang: 'en', lang2: 'zh' }), 1],
    ['2 ภาษาแต่ภาษาที่ 2 เป็นไทย', design({ lang2: 'th' }), 1],
    ['ฟอนต์ที่ไม่รองรับ', design({ font: 'Comic Sans' }), 1],
  ];
  for (const [name, options, packs] of validations) {
    await step(`validate: ${name} → 400`, async () => {
      const r = await addSticker(options, packs);
      return {
        status: r.status,
        ok: r.status === 400,
        detail: r.data?.message,
      };
    });
  }

  let thRow: any;
  let enRow: any;
  let colorRow: any;

  await step(
    'หยิบขาวดำ ไทย 1 แผ่น × 2 (ส่ง color มาด้วยต้องถูกตัดทิ้ง)',
    async () => {
      const r = await addSticker(design({ color: '#FF0000' }), 2);
      const rows = stickerRows(r.data?.cart);
      thRow = rows.find((x) => x.custom_options.lang === 'th');
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          rows.length === 1 &&
          thRow?.pro_code === BW &&
          thRow.custom_options.color === null &&
          thRow.sticker_quantity?.sheets === 2 &&
          thRow.sticker_quantity?.dots === 20,
        detail: `spc_id=${thRow?.spc_id} unit=${thRow?.spc_unit} amount=${thRow?.spc_amount}`,
      };
    },
  );

  await step('หยิบรูปแบบเดิมอีก 1 → รวมเป็นแถวเดียว 3 แผ่น', async () => {
    const r = await addSticker(
      design({ shopName: `  ${tag}   ร้านยาทดสอบ ` }),
      1,
    );
    const rows = stickerRows(r.data?.cart);
    const row = rows.find((x) => x.custom_options.lang === 'th');
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        rows.length === 1 &&
        row?.spc_id === thRow?.spc_id &&
        row?.sticker_quantity?.sheets === 3,
      detail: `rows=${rows.length} sheets=${row?.sticker_quantity?.sheets}`,
    };
  });

  await step(
    'หยิบรูปแบบต่าง (English) → แยกเป็นอีกแถวในสินค้าเดียวกัน',
    async () => {
      const r = await addSticker(design({ lang: 'en' }), 1);
      const rows = stickerRows(r.data?.cart);
      enRow = rows.find((x) => x.custom_options.lang === 'en');
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          rows.length === 2 &&
          enRow?.pro_code === BW &&
          enRow?.spc_id !== thRow?.spc_id,
        detail: `rows=${rows.length}`,
      };
    },
  );

  await step('หยิบสี 50 แผ่น × 1 → รหัส -07 หน่วย ม500ดวง', async () => {
    const r = await addSticker(
      design({
        printMode: 'color',
        color: '#c0392b',
        lang: 'ar',
        packSize: '50',
      }),
      1,
    );
    const rows = stickerRows(r.data?.cart);
    colorRow = rows.find((x) => x.pro_code === COLOR);
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        colorRow?.spc_unit === 'ม500ดวง' &&
        Number(colorRow?.spc_amount) === 1 &&
        colorRow?.custom_options?.color === '#C0392B' &&
        colorRow?.sticker_quantity?.sheets === 50 &&
        colorRow?.sticker_quantity?.dots === 500,
      detail: `unit=${colorRow?.spc_unit} sheets=${colorRow?.sticker_quantity?.sheets}`,
    };
  });

  await step('แก้จำนวนแถวไทยเป็น 5 แผ่น (แถวอื่นไม่เปลี่ยน)', async () => {
    const r = await user.post('/ecom/sticker-label/cart/update', {
      spc_id: thRow?.spc_id,
      packs: 5,
      clientVersion: cartVersion,
    });
    if (r.data?.cartVersion != null) cartVersion = r.data.cartVersion;
    const rows = stickerRows(r.data?.cart);
    const th = rows.find((x) => x.spc_id === thRow?.spc_id);
    const en = rows.find((x) => x.spc_id === enRow?.spc_id);
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        th?.sticker_quantity?.sheets === 5 &&
        en?.sticker_quantity?.sheets === 1,
      detail: `th=${th?.sticker_quantity?.sheets} en=${en?.sticker_quantity?.sheets}`,
    };
  });

  await step('ตั้งแถว English = 0 → ลบเฉพาะแถวนั้น', async () => {
    const r = await user.post('/ecom/sticker-label/cart/update', {
      spc_id: enRow?.spc_id,
      packs: 0,
      clientVersion: cartVersion,
    });
    if (r.data?.cartVersion != null) cartVersion = r.data.cartVersion;
    const rows = stickerRows(r.data?.cart);
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        rows.length === 2 &&
        !rows.some((x) => x.spc_id === enRow?.spc_id),
      detail: `rows=${rows.length}`,
    };
  });

  await step(
    'รูปแบบเดิมแต่ฟอนต์ Kanit → แยกแถวใหม่ เก็บ font · sarabun = แถวเดิม',
    async () => {
      const r = await addSticker(design({ font: 'kanit' }), 1);
      if (r.data?.cartVersion != null) cartVersion = r.data.cartVersion;
      const rows = stickerRows(r.data?.cart);
      const kanit = rows.find((x) => x.custom_options.font === 'kanit');
      // sarabun = ค่าเริ่มต้น → ไม่เก็บ font และรวมกับแถวไทยเดิม
      const s = await addSticker(design({ font: 'sarabun' }), 1);
      if (s.data?.cartVersion != null) cartVersion = s.data.cartVersion;
      const after = stickerRows(s.data?.cart);
      const th = after.find((x) => x.spc_id === thRow?.spc_id);
      // คืนสภาพตะกร้าให้ขั้นต่อไป
      const del = await user.post('/ecom/sticker-label/cart/update', {
        spc_id: kanit?.spc_id,
        packs: 0,
        clientVersion: cartVersion,
      });
      if (del.data?.cartVersion != null) cartVersion = del.data.cartVersion;
      const back = await user.post('/ecom/sticker-label/cart/update', {
        spc_id: thRow?.spc_id,
        packs: 5,
        clientVersion: cartVersion,
      });
      if (back.data?.cartVersion != null) cartVersion = back.data.cartVersion;
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          rows.length === 3 &&
          !!kanit &&
          kanit.spc_id !== thRow?.spc_id &&
          s.status === 201 &&
          after.length === 3 &&
          th?.sticker_quantity?.sheets === 6 &&
          th?.custom_options?.font === undefined &&
          del.status === 201 &&
          stickerRows(back.data?.cart).length === 2,
        detail: `kanit spc=${kanit?.spc_id} th sheets=${th?.sticker_quantity?.sheets}`,
      };
    },
  );

  await step('แก้แถวที่ไม่มี/ไม่ใช่ของร้าน → 404', async () => {
    const r = await user.post('/ecom/sticker-label/cart/update', {
      spc_id: 2147483000,
      packs: 1,
    });
    return { status: r.status, ok: r.status === 404 };
  });

  await step('GET ตะกร้าคืน custom_options + จำนวนแผ่น', async () => {
    const r = await user.get(`/ecom/product-cart/${memCode}`);
    if (r.data?.cartVersion != null) cartVersion = r.data.cartVersion;
    const rows = stickerRows(r.data?.cart);
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        rows.length === 2 &&
        rows.every((x) => x.sticker_quantity && x.custom_options.shopName),
      detail: `rows=${rows.length}`,
    };
  });

  // ---------------- สั่งซื้อ → snapshot ----------------

  let runnings: string[] = [];
  await step('สั่งซื้อจากตะกร้า', async () => {
    const r = await user.post('/ecom/submit-order', {
      mem_code: memCode,
      total_price: 0,
      listFree: null,
      priceOption: 'C',
      paymentOptions: 'โอนเงิน',
      shippingOptions: 'ขนส่ง',
      addressed: null,
    });
    runnings = Array.isArray(r.data) ? r.data : [];
    return {
      status: r.status,
      ok: r.status === 201 && runnings.length > 0,
      detail: `soh_running=${runnings.join(',')}`,
    };
  });

  await step('ตะกร้าว่างหลังสั่ง', async () => {
    const r = await user.get(`/ecom/product-cart/${memCode}`);
    return {
      status: r.status,
      ok: r.status === 200 && stickerRows(r.data?.cart).length === 0,
    };
  });

  await step(
    'last-options คืนรูปแบบจากออเดอร์ล่าสุด (ไม่มี sheets/dots)',
    async () => {
      const r = await user.get('/ecom/sticker-label/last-options');
      const o = r.data?.custom_options;
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          o?.shopName === `${tag} ร้านยาทดสอบ` &&
          // บรรทัดล่าสุดของออเดอร์รอบนี้คืองานสี (-07 เรียงหลัง -05)
          o?.printMode === 'color' &&
          o?.lang === 'ar' &&
          o?.color === '#C0392B' &&
          o?.packSize === '50' &&
          o?.sheets === undefined,
        detail: `printMode=${o?.printMode} lang=${o?.lang}`,
      };
    },
  );

  await step(
    'last-options?pro_code=-05 คืนรูปแบบขาวดำล่าสุด (สั่งซ้ำแบบเดิม)',
    async () => {
      const r = await user.get(
        '/ecom/sticker-label/last-options?pro_code=95030411-05',
      );
      const o = r.data?.custom_options;
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          o?.printMode === 'bw' &&
          o?.color === null &&
          String(o?.shopName ?? '').startsWith(tag),
        detail: `printMode=${o?.printMode} shop=${o?.shopName}`,
      };
    },
  );

  await step('last-options?pro_code=ไม่ใช่สติ๊กเกอร์ → 400', async () => {
    const r = await user.get(
      '/ecom/sticker-label/last-options?pro_code=10000001',
    );
    return { status: r.status, ok: r.status === 400 };
  });

  await step(
    'ประวัติออเดอร์: รูปแบบสติ๊กเกอร์ของออเดอร์นี้ (ECWC-701)',
    async () => {
      const r = await user.get(`/ecom/sticker-label/orders/${runnings[0]}`);
      const rows = Array.isArray(r.data) ? r.data : [];
      const other = await admin.get(
        `/ecom/sticker-label/orders/${runnings[0]}`,
      );
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          rows.length === 2 &&
          rows.some(
            (x: any) => x.pro_code === BW && x.custom_options?.sheets === 5,
          ) &&
          rows.some(
            (x: any) => x.pro_code === COLOR && x.custom_options?.sheets === 50,
          ) &&
          other.status === 200 &&
          Array.isArray(other.data) &&
          other.data.length === 0,
        detail: `rows=${rows.length} ร้านอื่นเห็น=${other.data?.length}`,
      };
    },
  );

  await step(
    'ฉลาก 2 ภาษา ไทย+จีน → แยกแถวจากไทยล้วน เก็บ lang2 แล้วลบออก',
    async () => {
      // หลังสั่งซื้อ ตะกร้าเปลี่ยนเวอร์ชันแล้ว — ใช้เวอร์ชันล่าสุด
      const before = await user.get(`/ecom/product-cart/${memCode}`);
      if (before.data?.cartVersion != null)
        cartVersion = before.data.cartVersion;
      const single = await addSticker(design(), 1);
      const r = await addSticker(design({ lang2: 'zh' }), 1);
      const rows = stickerRows(r.data?.cart);
      const bi = rows.find((x) => x.custom_options.lang2 === 'zh');
      const th = rows.find(
        (x) => x.custom_options.lang === 'th' && !x.custom_options.lang2,
      );
      const ok =
        single.status === 201 &&
        r.status === 201 &&
        !!bi &&
        !!th &&
        bi.spc_id !== th.spc_id;
      for (const row of rows) {
        await user.post('/ecom/sticker-label/cart/update', {
          spc_id: row.spc_id,
          packs: 0,
        });
      }
      const after = await user.get(`/ecom/product-cart/${memCode}`);
      if (after.data?.cartVersion != null) cartVersion = after.data.cartVersion;
      return {
        status: r.status,
        ok: ok && stickerRows(after.data?.cart).length === 0,
        detail: `rows=${rows.length} lang2=${bi?.custom_options?.lang2}`,
      };
    },
  );

  // ---------------- ECWC-702 คิวพิมพ์ ----------------

  await step('ลูกค้าเรียก API admin → 403', async () => {
    const r = await user.get('/ecom/admin/sticker-label/queue');
    return { status: r.status, ok: r.status === 403 };
  });

  await step('validate queue: status ผิด / page ผิด → 400', async () => {
    const a = await admin.get('/ecom/admin/sticker-label/queue?status=xx');
    const b = await admin.get('/ecom/admin/sticker-label/queue?page=2a');
    return {
      status: a.status,
      ok: a.status === 400 && b.status === 400,
      detail: `status=${a.status} page=${b.status}`,
    };
  });

  let bwLine: any;
  let colorLine: any;
  let summaryBefore: any;
  await step(
    'คิวรอพิมพ์มีทั้ง 2 งานจาก snapshot + สรุปแยกขาวดำ/สี',
    async () => {
      const r = await admin.get(
        '/ecom/admin/sticker-label/queue?status=pending&limit=200',
      );
      const mine = (r.data?.items ?? []).filter((i: any) =>
        runnings.includes(i.soh_running),
      );
      bwLine = mine.find((i: any) => i.pro_code === BW);
      colorLine = mine.find((i: any) => i.pro_code === COLOR);
      summaryBefore = r.data?.summary;
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          mine.length === 2 &&
          bwLine?.sheets === 5 &&
          bwLine?.dots === 50 &&
          bwLine?.custom_options?.lang === 'th' &&
          colorLine?.sheets === 50 &&
          colorLine?.custom_options?.color === '#C0392B' &&
          bwLine?.status === 'pending' &&
          bwLine?.print_count === 0 &&
          summaryBefore?.bw?.sheets >= 5 &&
          summaryBefore?.color?.sheets >= 50,
        detail: `bw spo=${bwLine?.spo_id} color spo=${colorLine?.spo_id} summary bw=${summaryBefore?.bw?.sheets} color=${summaryBefore?.color?.sheets}`,
      };
    },
  );

  await step('รายการเครื่องพิมพ์จาก env', async () => {
    const r = await admin.get('/ecom/admin/sticker-label/printers');
    const ids = (r.data ?? []).map((p: any) => p.id);
    return {
      status: r.status,
      ok:
        r.status === 200 && ids.includes('e2e-bw') && ids.includes('e2e-color'),
      detail: ids.join(','),
    };
  });

  const print = (
    ids: number[],
    print_type: string,
    printer: string,
    extra = {},
  ) =>
    admin.post('/ecom/admin/sticker-label/print', {
      order_line_ids: ids,
      print_type,
      printer,
      ...extra,
    });

  await step('พิมพ์งานสีด้วยเครื่องขาวดำ → 400 (ไม่บันทึก log)', async () => {
    const r = await print(
      [bwLine?.spo_id, colorLine?.spo_id],
      'print',
      'e2e-bw',
    );
    const logs = await admin.get(
      `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/logs`,
    );
    return {
      status: r.status,
      ok: r.status === 400 && logs.data?.logs?.length === 0,
      detail: r.data?.message,
    };
  });

  await step('print_type / เครื่องพิมพ์ ไม่ถูกต้อง → 400', async () => {
    const a = await print([bwLine?.spo_id], 'scan', 'e2e-bw');
    const b = await print([bwLine?.spo_id], 'print', 'no-such-printer');
    const c = await print([], 'print', 'e2e-bw');
    return {
      status: a.status,
      ok: a.status === 400 && b.status === 400 && c.status === 400,
      detail: `${a.status}/${b.status}/${c.status}`,
    };
  });

  // ---------------- ECWC-704 PDF ----------------

  const printPdf = (ids: number[], print_type: string, printer: string) =>
    admin.post(
      '/ecom/admin/sticker-label/print/pdf',
      { order_line_ids: ids, print_type, printer },
      { responseType: 'arraybuffer' },
    );
  const pdfInfo = (data: unknown) => {
    const text = Buffer.from(data as ArrayBuffer).toString('latin1');
    return {
      isPdf: text.startsWith('%PDF-'),
      pages: (text.match(/\/Type\s*\/Page[^s]/g) ?? []).length,
      a4: text.includes('/MediaBox [0 0 594.95996 841.91998]'),
    };
  };

  await step('preview PDF 1 หน้า A4 (ไม่บันทึก log)', async () => {
    const r = await admin.get(
      `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/preview.pdf`,
      { responseType: 'arraybuffer' },
    );
    const info = pdfInfo(r.data);
    const logs = await admin.get(
      `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/logs`,
    );
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        String(r.headers['content-type']).includes('application/pdf') &&
        info.isPdf &&
        info.a4 &&
        info.pages === 1 &&
        logs.data?.logs?.length === 0,
      detail: `pages=${info.pages} a4=${info.a4}`,
    };
  });

  await step('ลูกค้าเรียก preview PDF → 403', async () => {
    const r = await user.get(
      `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/preview.pdf`,
    );
    return { status: r.status, ok: r.status === 403 };
  });

  // ---------------- ส่งออก CMYK ให้ทีมกราฟิก (ต้องมี Ghostscript — รันกับ Docker image) ----------------

  const exportFiles = (ids: unknown[], format: string, extra = {}) =>
    admin.post(
      '/ecom/admin/sticker-label/export',
      { order_line_ids: ids, format, ...extra },
      { responseType: 'arraybuffer' },
    );
  const noGs = (status: number) =>
    status === 503
      ? 'ไม่มี Ghostscript บนเซิร์ฟเวอร์ — รันกับ Docker image'
      : '';
  /** จำนวน component ของ JPEG (4 = CMYK) */
  const jpegComponents = (b: Buffer) => {
    let i = 2;
    while (i < b.length - 9) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xc2) return b[i + 9];
      i += 2 + b.readUInt16BE(i + 2);
    }
    return 0;
  };

  await step(
    'ส่งออก .ai งานขาวดำ → PDF CMYK ไฟล์เดียว ไม่ลงประวัติ',
    async () => {
      const r = await exportFiles([bwLine?.spo_id], 'ai');
      const head = Buffer.from(r.data as ArrayBuffer)
        .subarray(0, 5)
        .toString('latin1');
      const logs = await admin.get(
        `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/logs`,
      );
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          head === '%PDF-' &&
          /filename="sticker-bw-\d+\.ai"/.test(
            String(r.headers['content-disposition']),
          ) &&
          logs.data?.logs?.length === 0,
        detail: noGs(r.status) || `${String(r.headers['content-disposition'])}`,
      };
    },
  );

  await step('ส่งออก .jpg งานสี 1 งาน → JPEG CMYK (4 component)', async () => {
    const r = await exportFiles([colorLine?.spo_id], 'jpg');
    const comps =
      r.status === 201 ? jpegComponents(Buffer.from(r.data as ArrayBuffer)) : 0;
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        String(r.headers['content-type']).includes('image/jpeg') &&
        comps === 4,
      detail: noGs(r.status) || `components=${comps}`,
    };
  });

  await step('ส่งออก .psd → ไฟล์ Photoshop CMYK', async () => {
    const r = await exportFiles([bwLine?.spo_id], 'psd');
    const b = Buffer.from(r.data as ArrayBuffer);
    const ok =
      r.status === 201 &&
      b.subarray(0, 4).toString('latin1') === '8BPS' &&
      b.readUInt16BE(24) === 4;
    return {
      status: r.status,
      ok,
      detail: noGs(r.status) || `bytes=${b.length}`,
    };
  });

  await step('ส่งออกขาวดำ + สีปนกัน → 400', async () => {
    const r = await exportFiles([bwLine?.spo_id, colorLine?.spo_id], 'ai');
    return { status: r.status, ok: r.status === 400 };
  });

  await step('ส่งออก format ไม่รองรับ / psd เกิน 10 งาน → 400', async () => {
    const a = await exportFiles([bwLine?.spo_id], 'pdf');
    const b = await exportFiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], 'psd');
    return {
      status: a.status,
      ok: a.status === 400 && b.status === 400,
      detail: `pdf=${a.status} psd11=${b.status}`,
    };
  });

  await step('ลูกค้าเรียกส่งออก → 403', async () => {
    const r = await user.post('/ecom/admin/sticker-label/export', {
      order_line_ids: [bwLine?.spo_id],
      format: 'ai',
    });
    return { status: r.status, ok: r.status === 403 };
  });

  await step('PDF งานสีกับเครื่องขาวดำ → 400 ไม่มี log', async () => {
    const r = await printPdf([colorLine?.spo_id], 'print', 'e2e-bw');
    const logs = await admin.get(
      `/ecom/admin/sticker-label/lines/${colorLine?.spo_id}/logs`,
    );
    return {
      status: r.status,
      ok: r.status === 400 && logs.data?.logs?.length === 0,
    };
  });

  await step('PDF พิมพ์ทดสอบ → 1 หน้า + id ของ log ใน header', async () => {
    const r = await printPdf([bwLine?.spo_id], 'test', 'e2e-bw');
    const info = pdfInfo(r.data);
    const logIds = String(r.headers['x-print-log-ids'] ?? '');
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        info.isPdf &&
        info.pages === 1 &&
        r.headers['x-print-pages'] === '1' &&
        /^\d+$/.test(logIds),
      detail: `pages=${info.pages} log=${logIds}`,
    };
  });

  await step('พิมพ์ทดสอบ (test) → 1 แผ่น สถานะยังรอพิมพ์', async () => {
    const r = await print([bwLine?.spo_id], 'test', 'e2e-bw');
    const q = await admin.get(
      '/ecom/admin/sticker-label/queue?status=pending&limit=200',
    );
    const line = (q.data?.items ?? []).find(
      (i: any) => i.spo_id === bwLine?.spo_id,
    );
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        r.data?.logs?.[0]?.sheets === 1 &&
        line?.status === 'pending' &&
        line?.print_count === 0,
      detail: `status=${line?.status} count=${line?.print_count}`,
    };
  });

  await step(
    'พิมพ์จริง (print) → พิมพ์แล้ว, printed_by จาก token ไม่ใช่ body',
    async () => {
      const r = await print([bwLine?.spo_id], 'print', 'e2e-bw', {
        printed_by: 'hacker',
        printed_at: '2000-01-01T00:00:00Z',
      });
      const log = r.data?.logs?.[0];
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          log?.printed_by === adminJwt.username &&
          log?.sheets === 5 &&
          new Date(log?.printed_at).getFullYear() >= 2026,
        detail: `printed_by=${log?.printed_by} sheets=${log?.sheets}`,
      };
    },
  );

  await step('print ซ้ำงานที่พิมพ์แล้ว → 400 ให้ใช้ reprint', async () => {
    const r = await print([bwLine?.spo_id], 'print', 'e2e-bw');
    return { status: r.status, ok: r.status === 400, detail: r.data?.message };
  });

  await step('reprint → จำนวนครั้ง 2 สถานะยังพิมพ์แล้ว', async () => {
    const r = await print([bwLine?.spo_id], 'reprint', 'e2e-color');
    const q = await admin.get(
      '/ecom/admin/sticker-label/queue?status=printed&limit=200',
    );
    const line = (q.data?.items ?? []).find(
      (i: any) => i.spo_id === bwLine?.spo_id,
    );
    return {
      status: r.status,
      ok:
        r.status === 201 &&
        line?.status === 'printed' &&
        line?.print_count === 2 &&
        line?.last_printed_by === adminJwt.username,
      detail: `count=${line?.print_count} last=${line?.last_printed_by}`,
    };
  });

  await step(
    'PDF งานสี 50 แผ่นด้วยเครื่องสี → 50 หน้า, คิวรอพิมพ์ไม่มีงานของออเดอร์นี้',
    async () => {
      const r = await printPdf([colorLine?.spo_id], 'print', 'e2e-color');
      const info = pdfInfo(r.data);
      const q = await admin.get(
        '/ecom/admin/sticker-label/queue?status=pending&limit=200',
      );
      const left = (q.data?.items ?? []).filter((i: any) =>
        runnings.includes(i.soh_running),
      );
      const s = q.data?.summary;
      return {
        status: r.status,
        ok:
          r.status === 201 &&
          info.isPdf &&
          info.pages === 50 &&
          r.headers['x-print-pages'] === '50' &&
          left.length === 0 &&
          s?.color?.sheets === summaryBefore?.color?.sheets - 50 &&
          s?.bw?.sheets === summaryBefore?.bw?.sheets - 5,
        detail: `pdf pages=${info.pages} pending left=${left.length} summary bw=${s?.bw?.sheets} color=${s?.color?.sheets}`,
      };
    },
  );

  await step('ประวัติการพิมพ์ของงานขาวดำ (ใหม่สุดก่อน)', async () => {
    const r = await admin.get(
      `/ecom/admin/sticker-label/lines/${bwLine?.spo_id}/logs`,
    );
    const types = (r.data?.logs ?? []).map((l: any) => l.print_type).join(',');
    return {
      status: r.status,
      ok:
        r.status === 200 &&
        types === 'reprint,print,test,test' &&
        r.data?.custom_options?.shopName === `${tag} ร้านยาทดสอบ`,
      detail: types,
    };
  });

  await step('ประวัติของ order line ที่ไม่ใช่สติ๊กเกอร์ → 404', async () => {
    const r = await admin.get(
      '/ecom/admin/sticker-label/lines/2147483000/logs',
    );
    return { status: r.status, ok: r.status === 404 };
  });

  await step('admin ปิด flag sticker_label คืน', async () => {
    const r = await admin.post('/ecom/feature-flag/update-flag', {
      flag: 'sticker_label',
      status: false,
    });
    const c = await user.get('/ecom/sticker-label/config');
    return { status: r.status, ok: r.status < 300 && c.status === 403 };
  });

  const passed = results.filter((r) => r.ok).length;
  const md = [
    `# Sticker label (ECWC-697) E2E report`,
    ``,
    `- environment: **${E2E_ENV}**${E2E_ENV === 'local' ? ' (เครื่อง dev + DB ทดสอบ ไม่ใช่ deployed code)' : ' (deployed code)'}`,
    `- BASE_URL: ${BASE_URL}`,
    `- commit: ${GIT_SHA}`,
    `- run at: ${new Date().toISOString()}`,
    `- ร้านทดสอบ: ${memCode} · admin: ${adminJwt.mem_code}`,
    `- ออเดอร์ทดสอบที่สร้าง: ${runnings.join(', ') || '-'}`,
    `- ครอบคลุม: ECWC-698 ตัวเลือก/map รหัส · ECWC-699 custom_options ตะกร้า/snapshot · ECWC-702 คิวพิมพ์ + sticker_print_log · ECWC-704 PDF A4 (ดวง 80×50 มม.)`,
    `- result: **${passed}/${results.length} passed**`,
    ``,
    `| # | step | status | ok | detail |`,
    `|---|------|--------|----|--------|`,
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.step} | ${r.status ?? ''} | ${r.ok ? 'PASS' : 'FAIL'} | ${String(r.detail ?? '').replace(/\|/g, '\\|')} |`,
    ),
  ].join('\n');
  const dir = join(process.cwd(), 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `sticker-label-${E2E_ENV}-${Date.now()}.md`);
  writeFileSync(file, md);
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(passed === results.length ? 0 : 1);
}

void main();
