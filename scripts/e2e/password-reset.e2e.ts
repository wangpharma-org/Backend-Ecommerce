/* eslint-disable no-console, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any, @typescript-eslint/require-await */
/**
 * E2E: ลืมรหัสผ่าน → พนักงานขายโทรยืนยันตัวตน → รีเซ็ตด้วยรหัสผ่านชั่วคราว (ECWC-706) ยิง API จริง
 *
 * ใช้:
 *   BASE_URL=https://<api>/api E2E_ENV=dev|prod ADMIN_TOKEN=<jwt admin> INTERNAL_TOKEN=<INTERNAL_API_TOKEN ของ server> \
 *   npx ts-node scripts/e2e/password-reset.e2e.ts
 *
 * เงื่อนไขก่อนรัน
 * - รัน scripts/seed/ecwc706-password-reset.sql ก่อนทุกครั้ง (บัญชีทดสอบ + ล้างคำขอเก่า + คืนรหัสผ่าน)
 *   **ห้ามรันกับ production** — สคริปต์นี้รีเซ็ตรหัสผ่านบัญชีทดสอบจริง
 * - feature flag password_reset_request ปิดอยู่ (สคริปต์เปิดเองแล้วปิดคืนเมื่อจบ)
 * - บัญชีทดสอบใช้รหัสผ่าน E2E_PASSWORD (ค่าเริ่มต้น e2e-test-pass-2026) — สคริปต์ login เอง ไม่ต้องส่ง token
 *
 * ฝั่งพนักงานเรียกแบบที่ sale service (wangpharma-sale-backend) เรียกจริง: /ecom/internal/password-reset/*
 * + x-internal-token + x-actor-* (รหัสพนักงาน E2E706S ดูแลร้านทดสอบ, E2E706X ไม่ได้ดูแล, E2E706-SUP หัวหน้าเห็นทุกร้าน)
 * ข้อมูลทดสอบ: ร้าน E2E706 (ชื่อขึ้นต้น "E2E local")
 * จบแล้วรหัสผ่านร้านทดสอบเป็นค่าที่สคริปต์ตั้ง (รัน seed เพื่อคืนค่า) · คำขอทดสอบยังอยู่ในตาราง
 * ผลลัพธ์เขียนลง docs/e2e/password-reset-<env>-<timestamp>.md
 */
import axios, { AxiosError, AxiosInstance } from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000/api';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN ?? '';
const INTERNAL_TOKEN = process.env.INTERNAL_TOKEN ?? '';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';
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

if (!ADMIN_TOKEN || !INTERNAL_TOKEN) {
  console.error(
    'ต้องตั้ง ADMIN_TOKEN (เปิด/ปิด feature flag) และ INTERNAL_TOKEN (= INTERNAL_API_TOKEN ของ server)',
  );
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

const STORE_CODE = 'E2E706';
const STORE_USER = 'e2e706_store';
const NEW_PASSWORD = `e2eNew${Date.now() % 100000}x1`;
const UA_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; E2E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36';

const client = (token?: string): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    validateStatus: () => true,
    timeout: 30000,
  });
const admin = client(ADMIN_TOKEN);
const anon = client();

/** พนักงานที่เรียกผ่าน sale service — x-actor-* คือสิ่งที่ sale backend ส่งมาหลังตรวจ JWT ของ Wang Auth */
const staff = (
  empCode: string,
  name: string,
  opts: { all?: boolean; supervisor?: boolean; token?: string } = {},
): AxiosInstance =>
  axios.create({
    baseURL: BASE_URL,
    headers: {
      'x-internal-token': opts.token ?? INTERNAL_TOKEN,
      'x-actor-emp-code': empCode,
      'x-actor-name': encodeURIComponent(name),
      ...(opts.all ? { 'x-actor-scope': 'all' } : {}),
      ...(opts.supervisor ? { 'x-actor-supervisor': '1' } : {}),
    },
    validateStatus: () => true,
    timeout: 30000,
  });
const sale = staff('E2E706S', 'E2E local เซลล์ A');
const sale2 = staff('E2E706X', 'E2E local เซลล์ B');
const supervisor = staff('E2E706-SUP', 'E2E local หัวหน้า', {
  all: true,
  supervisor: true,
});

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

function decodeJwt(token: string): Record<string, any> {
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

const login = (username: string, password: string) =>
  anon.post('/ecom/login', { username, password });

async function setFlag(status: boolean) {
  return admin.post('/ecom/feature-flag/update-flag', {
    flag: 'password_reset_request',
    status,
  });
}

async function main() {
  console.log(
    `E2E password-reset env=${E2E_ENV} base=${BASE_URL} commit=${GIT_SHA}`,
  );
  const flagBefore = await anon.get(
    '/ecom/feature-flag/password_reset_request',
  );
  const wasEnabled = flagBefore.data === true;

  const storeLogin = await login(STORE_USER, PASSWORD);
  const storeToken: string = storeLogin.data?.token;
  const storeRefresh: string = storeLogin.data?.refresh_token;
  const store = client(storeToken);

  try {
    // ---------- flag ----------
    await setFlag(false);
    await step('flag ปิด → ส่งคำขอไม่ได้ (403)', async () => {
      const r = await anon.post('/ecom/password-reset/requests', {
        account: STORE_CODE,
      });
      return { status: r.status, ok: r.status === 403 };
    });
    await step('flag ปิด → หน้าพนักงานใช้ไม่ได้ (403)', async () => {
      const r = await sale.get('/ecom/internal/password-reset/requests');
      return { status: r.status, ok: r.status === 403 };
    });
    const on = await setFlag(true);
    await step('admin เปิด flag password_reset_request', async () => ({
      status: on.status,
      ok: on.status < 300,
    }));

    // ---------- ลูกค้าส่งคำขอ ----------
    await step('validation: ไม่กรอกบัญชี → 400', async () => {
      const r = await anon.post('/ecom/password-reset/requests', {
        account: '  ',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('validation: แจ้งเปลี่ยนเบอร์แต่เบอร์ผิด → 400', async () => {
      const r = await anon.post('/ecom/password-reset/requests', {
        account: STORE_CODE,
        phone_changed: true,
        callback_phone: '08x1234',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step(
      'validation: phone_changed เป็น "true" (string) ไม่นับว่าแจ้งเปลี่ยนเบอร์',
      async () => {
        const r = await anon.post('/ecom/password-reset/requests', {
          account: `e2e-nouser-str-${Date.now()}`,
          phone_changed: 'true',
          callback_phone: 'abc',
        });
        return {
          status: r.status,
          ok: r.status === 200 && r.data.phone_changed === false,
        };
      },
    );

    const unknown = await anon.post('/ecom/password-reset/requests', {
      account: `e2e-nouser-${Date.now()}`,
    });
    const created = await client().post(
      '/ecom/password-reset/requests',
      {
        account: STORE_CODE,
        phone_changed: true,
        callback_phone: '081-234-9907',
      },
      { headers: { 'User-Agent': UA_ANDROID } },
    );
    const ref: string = created.data?.ref_code;
    await step(
      'ส่งคำขอบัญชีจริง → ได้รหัสอ้างอิง PR-XXXXXXX + เบอร์ mask',
      async () => ({
        status: created.status,
        ok:
          created.status === 200 &&
          /^PR-[A-Z0-9]{7}$/.test(ref) &&
          created.data.status === 'pending' &&
          created.data.callback_phone_masked === '08X-XXX-9907',
        detail: ref,
      }),
    );
    await step(
      'บัญชีที่ไม่มีจริงได้คำตอบรูปแบบเดียวกัน (กันเดาบัญชี)',
      async () => ({
        status: unknown.status,
        ok:
          unknown.status === 200 &&
          /^PR-[A-Z0-9]{7}$/.test(unknown.data.ref_code) &&
          JSON.stringify(Object.keys(unknown.data).sort()) ===
            JSON.stringify(Object.keys(created.data).sort()),
      }),
    );
    await step('ส่งซ้ำระหว่างรอ → ได้คำขอเดิม', async () => {
      const r = await anon.post('/ecom/password-reset/requests', {
        account: STORE_CODE.toLowerCase(),
      });
      return {
        status: r.status,
        ok: r.status === 200 && r.data.ref_code === ref,
      };
    });
    await step('ดูสถานะด้วยรหัสอ้างอิง → pending', async () => {
      const r = await anon.get(`/ecom/password-reset/requests/${ref}`);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data.status === 'pending' &&
          !('mem_code' in r.data),
      };
    });
    await step('รหัสอ้างอิงผิดรูปแบบ / ไม่มี → 404', async () => {
      const a = await anon.get('/ecom/password-reset/requests/toString');
      const b = await anon.get('/ecom/password-reset/requests/PR-ZZZZZZZ');
      return { status: b.status, ok: a.status === 404 && b.status === 404 };
    });

    // ---------- สิทธิ์ฝั่งพนักงาน ----------
    await step('ไม่มี internal token → หน้าพนักงาน 403', async () => {
      const r = await anon.get('/ecom/internal/password-reset/requests');
      return { status: r.status, ok: r.status === 403 };
    });
    await step('token ร้านค้า (JWT) เรียก internal ไม่ได้ → 403', async () => {
      const r = await store.get('/ecom/internal/password-reset/requests');
      return { status: r.status, ok: r.status === 403 };
    });
    await step('internal token ผิด → 403', async () => {
      const r = await staff('E2E706S', 'x', { token: 'wrong-token' }).get(
        '/ecom/internal/password-reset/requests',
      );
      return { status: r.status, ok: r.status === 403 };
    });
    await step('ไม่ส่ง / ส่งรหัสพนักงานผิดรูปแบบ → 400', async () => {
      const r = await staff('E2E 706;', 'x').get(
        '/ecom/internal/password-reset/requests',
      );
      return { status: r.status, ok: r.status === 400 };
    });

    const list = await sale.get('/ecom/internal/password-reset/requests', {
      params: { tab: 'pending' },
    });
    const item = (list.data?.items ?? []).find((x: any) => x.ref_code === ref);
    const id: number = item?.id;
    await step(
      'เซลล์ที่ดูแล: เห็นคำขอในแท็บรอยืนยัน + จำนวน badge',
      async () => ({
        status: list.status,
        ok:
          list.status === 200 &&
          !!item &&
          item.mem_code === STORE_CODE &&
          item.phone_changed === true &&
          list.data.counts.pending >= 1 &&
          !(list.data.items ?? []).some(
            (x: any) => x.ref_code === unknown.data.ref_code,
          ),
        detail: `id=${id} pending=${list.data?.counts?.pending}`,
      }),
    );
    await step('summary (badge เมนู) ของเซลล์', async () => {
      const r = await sale.get('/ecom/internal/password-reset/summary');
      return { status: r.status, ok: r.status === 200 && r.data.pending >= 1 };
    });
    await step('เซลล์อีกคน: ไม่เห็นในรายการ + ดูรายละเอียด 403', async () => {
      const l = await sale2.get('/ecom/internal/password-reset/requests');
      const d = await sale2.get(`/ecom/internal/password-reset/requests/${id}`);
      return {
        status: d.status,
        ok:
          l.status === 200 &&
          !(l.data.items ?? []).some((x: any) => x.ref_code === ref) &&
          d.status === 403,
      };
    });
    await step('เซลล์อีกคน: กดรีเซ็ตแทนไม่ได้ (403)', async () => {
      const r = await sale2.post(
        `/ecom/internal/password-reset/requests/${id}/approve`,
        {
          checklist: { called: true, ref_ok: true, info_ok: true },
          mode: 'auto',
        },
      );
      return { status: r.status, ok: r.status === 403 };
    });
    await step('id ไม่ใช่ตัวเลข → 400', async () => {
      const r = await sale.get('/ecom/internal/password-reset/requests/2a');
      return { status: r.status, ok: r.status === 400 };
    });

    const detail = await sale.get(
      `/ecom/internal/password-reset/requests/${id}`,
    );
    await step('รายละเอียด: ข้อมูลในระบบเทียบกับข้อมูลจากคำขอ', async () => ({
      status: detail.status,
      ok:
        detail.status === 200 &&
        detail.data.store.mem_code === STORE_CODE &&
        detail.data.store.phone_masked === '08X-XXX-4521' &&
        detail.data.request.callback_phone === '0812349907' &&
        detail.data.request.device === 'Chrome บน Android' &&
        detail.data.request.requests_30d >= 1 &&
        detail.data.can_disable_force_change === false,
      detail: `${detail.data?.store?.shop_name} · ${detail.data?.request?.device}`,
    }));

    // ---------- ยืนยันและรีเซ็ต ----------
    const approveUrl = `/ecom/internal/password-reset/requests/${id}/approve`;
    await step('รีเซ็ตโดย checklist ไม่ครบ → 400', async () => {
      const r = await sale.post(approveUrl, {
        checklist: { called: true, ref_ok: true, info_ok: false },
        mode: 'auto',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('checklist ส่งเป็น "true" (string) → 400', async () => {
      const r = await sale.post(approveUrl, {
        checklist: { called: 'true', ref_ok: true, info_ok: true },
        mode: 'auto',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('พิมพ์รหัสเองแต่อ่อนเกิน → 400', async () => {
      const r = await sale.post(approveUrl, {
        checklist: { called: true, ref_ok: true, info_ok: true },
        mode: 'manual',
        password: '12345678',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step(
      'เซลล์ปิด "บังคับตั้งรหัสใหม่" ไม่ได้ (เฉพาะหัวหน้า) → 403',
      async () => {
        const r = await sale.post(approveUrl, {
          checklist: { called: true, ref_ok: true, info_ok: true },
          mode: 'auto',
          force_change: false,
        });
        return { status: r.status, ok: r.status === 403 };
      },
    );

    const sibling = await anon.post('/ecom/password-reset/requests', {
      account: STORE_USER,
    });
    const approved = await sale.post(approveUrl, {
      checklist: { called: true, ref_ok: true, info_ok: true },
      mode: 'auto',
      note: 'E2E local โทรยืนยันแล้ว',
    });
    const temp: string = approved.data?.temp_password ?? '';
    await step(
      'ยืนยันตัวตนและรีเซ็ต (auto) → ได้รหัสชั่วคราวครั้งเดียว',
      async () => ({
        status: approved.status,
        ok:
          approved.status === 200 &&
          /^[A-Za-z0-9]{3}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$/.test(temp) &&
          approved.data.force_change === true &&
          /E2E706S/.test(approved.data.handled_by_name),
        detail: `handled_by=${approved.data?.handled_by_name}`,
      }),
    );
    await step(
      'คำขออื่นที่ค้างของร้านเดียวกันถูกปิดอัตโนมัติ + พนักงานเห็นเหตุผล',
      async () => {
        const st = await anon.get(
          `/ecom/password-reset/requests/${sibling.data?.ref_code}`,
        );
        const l = await sale.get('/ecom/internal/password-reset/requests', {
          params: { q: sibling.data?.ref_code },
        });
        const row = (l.data?.items ?? [])[0];
        return {
          status: st.status,
          ok:
            st.data?.status === 'expired' &&
            typeof row?.note === 'string' &&
            row.note.includes(ref),
          detail: row?.note,
        };
      },
    );
    await step('กดรีเซ็ตซ้ำ → 409', async () => {
      const r = await sale.post(approveUrl, {
        checklist: { called: true, ref_ok: true, info_ok: true },
        mode: 'auto',
      });
      return { status: r.status, ok: r.status === 409 };
    });
    await step('รายละเอียดหลังรีเซ็ตไม่คืนรหัสชั่วคราวอีก', async () => {
      const r = await sale.get(`/ecom/internal/password-reset/requests/${id}`);
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data.status === 'approved' &&
          !JSON.stringify(r.data).includes(temp) &&
          !('temp_password_hash' in r.data),
      };
    });
    await step(
      'ลูกค้าดูสถานะ → approved + ผู้ยืนยัน "พนักงานขาย Wangpharma"',
      async () => {
        const r = await anon.get(`/ecom/password-reset/requests/${ref}`);
        return {
          status: r.status,
          ok:
            r.data.status === 'approved' &&
            r.data.verified_by === 'พนักงานขาย Wangpharma',
        };
      },
    );
    await step('refresh token ก่อนรีเซ็ตถูกยกเลิก', async () => {
      const r = await anon.post('/ecom/refresh_token', { token: storeRefresh });
      return { status: r.status, ok: !r.data?.token };
    });

    // ---------- ลูกค้าเข้าด้วยรหัสชั่วคราว ----------
    await step('รหัสผ่านเดิมใช้ไม่ได้แล้ว (401)', async () => {
      const r = await login(STORE_USER, PASSWORD);
      return { status: r.status, ok: r.status === 401 };
    });
    const tempLogin = await login(STORE_USER, temp);
    const tempToken: string = tempLogin.data?.token;
    const tempPayload = decodeJwt(tempToken ?? '');
    await step(
      'เข้าด้วยรหัสชั่วคราว → must_change_password + token ขอบเขต password_change',
      async () => ({
        status: tempLogin.status,
        ok:
          (tempLogin.status === 201 || tempLogin.status === 200) &&
          tempLogin.data.must_change_password === true &&
          tempPayload.scope === 'password_change' &&
          tempPayload.permission === false,
      }),
    );
    const tempClient = client(tempToken);
    await step(
      'token ชั่วคราวเรียก API อื่นไม่ได้ (ตะกร้า/ค้นสินค้า 403)',
      async () => {
        const r = await tempClient.post('/ecom/search-products', {
          keyword: 'para',
          offset: 0,
          limit: 1,
          mem_code: STORE_CODE,
        });
        return { status: r.status, ok: r.status === 403 };
      },
    );
    await step(
      'token ชั่วคราวเรียก change-password เดิมไม่ได้ (403)',
      async () => {
        const r = await tempClient.put('/ecom/password/change-password', {
          old_password: temp,
          new_password: NEW_PASSWORD,
        });
        return { status: r.status, ok: r.status === 403 };
      },
    );
    await step('refresh token ชั่วคราวยังคงขอบเขตเดิม', async () => {
      const r = await anon.post('/ecom/refresh_token', {
        token: tempLogin.data?.refresh_token,
      });
      const p = decodeJwt(r.data?.token ?? '');
      return {
        status: r.status,
        ok: !!r.data?.token && p.scope === 'password_change',
      };
    });
    const setUrl = '/ecom/password-reset/set-password';
    await step('ตั้งรหัสใหม่: ยืนยันไม่ตรง → 400', async () => {
      const r = await tempClient.post(setUrl, {
        new_password: NEW_PASSWORD,
        confirm_password: `${NEW_PASSWORD}x`,
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('ตั้งรหัสใหม่: ไม่มีตัวเลข → 400', async () => {
      const r = await tempClient.post(setUrl, {
        new_password: 'abcdefghij',
        confirm_password: 'abcdefghij',
      });
      return { status: r.status, ok: r.status === 400 };
    });
    await step('ตั้งรหัสใหม่: มีภาษาไทย (ลืมสลับแป้น) → 400', async () => {
      const r = await tempClient.post(setUrl, {
        new_password: 'ๅ/-ภถุะะ3a',
        confirm_password: 'ๅ/-ภถุะะ3a',
      });
      return {
        status: r.status,
        ok: r.status === 400 && r.data?.rules?.ascii_only === false,
      };
    });
    await step('ตั้งรหัสใหม่: ซ้ำกับรหัสชั่วคราว → 400', async () => {
      const r = await tempClient.post(setUrl, {
        new_password: temp,
        confirm_password: temp,
      });
      return {
        status: r.status,
        ok: r.status === 400 && r.data?.rules?.not_temp === false,
      };
    });
    await step('ตั้งรหัสใหม่สำเร็จ', async () => {
      const r = await tempClient.post(setUrl, {
        new_password: NEW_PASSWORD,
        confirm_password: NEW_PASSWORD,
        logout_all_devices: true,
      });
      return {
        status: r.status,
        ok:
          r.status === 200 &&
          r.data.success === true &&
          r.data.ref_code === ref,
      };
    });
    await step('รหัสชั่วคราวใช้ไม่ได้อีก (401)', async () => {
      const r = await login(STORE_USER, temp);
      return { status: r.status, ok: r.status === 401 };
    });
    const newLogin = await login(STORE_USER, NEW_PASSWORD);
    await step(
      'เข้าด้วยรหัสใหม่ → token ปกติ ไม่ถูกบังคับตั้งรหัส',
      async () => ({
        status: newLogin.status,
        ok:
          (newLogin.status === 201 || newLogin.status === 200) &&
          !newLogin.data.must_change_password &&
          !decodeJwt(newLogin.data.token).scope,
      }),
    );
    await step(
      'token ปกติเรียก set-password ไม่ได้ (ไม่ได้อยู่ในขั้นตอน) → 400',
      async () => {
        const r = await client(newLogin.data?.token).post(setUrl, {
          new_password: `${NEW_PASSWORD}2`,
          confirm_password: `${NEW_PASSWORD}2`,
        });
        return { status: r.status, ok: r.status === 400 };
      },
    );
    await step(
      'token password_change เดิม (ยังไม่หมด 15 นาที) ใช้ซ้ำหลังตั้งสำเร็จไม่ได้ → 400',
      async () => {
        const r = await tempClient.post(setUrl, {
          new_password: `${NEW_PASSWORD}3`,
          confirm_password: `${NEW_PASSWORD}3`,
        });
        return { status: r.status, ok: r.status === 400 };
      },
    );
    await step('ลูกค้าดูสถานะ → มีเวลาเปลี่ยนรหัสผ่าน', async () => {
      const r = await anon.get(`/ecom/password-reset/requests/${ref}`);
      return { status: r.status, ok: !!r.data.password_changed_at };
    });

    // ---------- ปฏิเสธ ----------
    const second = await anon.post('/ecom/password-reset/requests', {
      account: STORE_USER,
    });
    const ref2: string = second.data?.ref_code;
    const list2 = await sale.get('/ecom/internal/password-reset/requests', {
      params: { q: ref2 },
    });
    const id2: number = (list2.data?.items ?? [])[0]?.id;
    await step(
      'ส่งคำขอใหม่ด้วยชื่อบัญชี (username) → เซลล์ค้นเจอด้วยรหัสอ้างอิง',
      async () => ({
        status: list2.status,
        ok: second.status === 200 && ref2 !== ref && !!id2,
        detail: ref2,
      }),
    );
    const rejectUrl = `/ecom/internal/password-reset/requests/${id2}/reject`;
    await step('ปฏิเสธ: สาเหตุผิด / "อื่น ๆ" ไม่มีเหตุผล → 400', async () => {
      const a = await sale.post(rejectUrl, { reason: 'toString' });
      const b = await sale.post(rejectUrl, { reason: 'other' });
      return { status: b.status, ok: a.status === 400 && b.status === 400 };
    });
    await step('ปฏิเสธคำขอ (ผู้รับสายไม่ได้ส่งคำขอ)', async () => {
      const r = await sale.post(rejectUrl, {
        reason: 'not_requester',
        note: 'E2E local ทดสอบปฏิเสธ',
      });
      return {
        status: r.status,
        ok: r.status === 200 && r.data.status === 'rejected',
      };
    });
    await step('ปฏิเสธซ้ำ / รีเซ็ตหลังปฏิเสธ → 409', async () => {
      const a = await sale.post(rejectUrl, { reason: 'wrong_info' });
      const b = await sale.post(
        `/ecom/internal/password-reset/requests/${id2}/approve`,
        {
          checklist: { called: true, ref_ok: true, info_ok: true },
          mode: 'auto',
        },
      );
      return { status: b.status, ok: a.status === 409 && b.status === 409 };
    });
    await step(
      'คำขอที่ถูกปฏิเสธไม่เปลี่ยนรหัสผ่าน (รหัสใหม่ยังเข้าได้)',
      async () => {
        const s = await anon.get(`/ecom/password-reset/requests/${ref2}`);
        const r = await login(STORE_USER, NEW_PASSWORD);
        return {
          status: r.status,
          ok:
            s.data.status === 'rejected' &&
            (r.status === 201 || r.status === 200),
        };
      },
    );
    await step('แท็บปิดแล้วเห็นทั้ง 2 คำขอ', async () => {
      const r = await sale.get('/ecom/internal/password-reset/requests', {
        params: { tab: 'closed', q: STORE_CODE },
      });
      const refs = (r.data.items ?? []).map((x: any) => x.ref_code);
      return {
        status: r.status,
        ok: refs.includes(ref) && refs.includes(ref2),
      };
    });

    // ---------- จำกัดจำนวนคำขอ ----------
    // คำขอของ "e2e706_store" ใน 24 ชม. = 2 (ที่ถูกปิดอัตโนมัติ + ref2) → ส่งได้อีก 1 ครั้ง ครั้งที่ 4 โดนจำกัด
    const third = await anon.post('/ecom/password-reset/requests', {
      account: STORE_USER,
    });
    const id3 = (
      await sale.get('/ecom/internal/password-reset/requests', {
        params: { q: third.data?.ref_code },
      })
    ).data?.items?.[0]?.id;
    await sale.post(`/ecom/internal/password-reset/requests/${id3}/reject`, {
      reason: 'unreachable',
    });
    await step('ส่งคำขอเกิน 3 ครั้ง/24 ชม. ต่อบัญชี → 429', async () => {
      const r = await anon.post('/ecom/password-reset/requests', {
        account: STORE_USER,
      });
      return {
        status: r.status,
        ok: third.status === 200 && r.status === 429,
      };
    });

    // ---------- admin ----------
    await step(
      'หัวหน้า (scope all) เห็นคำขอของทุกเซลล์ + ปิด "บังคับตั้งรหัสใหม่" ได้',
      async () => {
        const r = await supervisor.get(
          `/ecom/internal/password-reset/requests/${id}`,
        );
        return {
          status: r.status,
          ok: r.status === 200 && r.data.can_disable_force_change === true,
        };
      },
    );
  } finally {
    const off = await setFlag(wasEnabled);
    await step(
      `คืนค่า flag password_reset_request = ${wasEnabled}`,
      async () => ({
        status: off.status,
        ok: off.status < 300,
      }),
    );
  }

  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const dir = join(__dirname, '..', '..', 'docs', 'e2e');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `password-reset-${E2E_ENV}-${stamp}.md`);
  const lines = [
    `# E2E — ลืมรหัสผ่าน / พนักงานขายยืนยันตัวตน (ECWC-706)`,
    '',
    `- environment: **${E2E_ENV}** (${BASE_URL})`,
    `- commit: \`${GIT_SHA}\``,
    `- เวลา: ${new Date().toISOString()}`,
    `- ผล: **${passed}/${results.length} ผ่าน**${failed ? ` · ไม่ผ่าน ${failed}` : ''}`,
    `- ข้อมูลทดสอบ: ร้าน ${STORE_CODE} ดูแลโดยพนักงาน E2E706S · ฝั่งพนักงานเรียกผ่าน /ecom/internal (seed: scripts/seed/ecwc706-password-reset.sql)`,
    '',
    '| # | ขั้นตอน | ผล | HTTP | หมายเหตุ |',
    '|---|---|---|---|---|',
    ...results.map(
      (r, i) =>
        `| ${i + 1} | ${r.step} | ${r.ok ? '✅' : '❌'} | ${r.status ?? ''} | ${(r.detail ?? '').replace(/\|/g, '\\|')} |`,
    ),
    '',
  ];
  writeFileSync(file, lines.join('\n'), 'utf8');
  console.log(`\n${passed}/${results.length} passed → ${file}`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
