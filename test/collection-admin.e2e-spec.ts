/**
 * E2E — สิ่งที่หน้าแอดมินต้องเรียกได้จริง (รีวิว PR รอบสอง ticket 10-12)
 *
 * ticket 12: แอดมินสร้างกระเช้าสำเร็จรูปไม่ได้ เพราะหน้าบ้านไม่มีปุ่มเรียก API
 *            สเปกนี้ไล่ครบวงจรที่หน้าจอใหม่ใช้: สร้าง → ใส่สินค้า → อ่านราคา → ลบ
 * ticket 10/11: การ์ด "ดีลพิเศษ" ในคอลเลกชันไม่รู้ว่าตัวเองเป็นดีลอะไรและอยู่หน้าไหน
 *            payload ที่ resolve มาต้องมี product/product2 และ special_deal
 *
 * รัน:  npm run test:e2e -- collection-admin
 */

export {};

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3021';
const API = `${BASE}/api`;
const USERNAME = process.env.E2E_USERNAME ?? 'e2e_test_user';
const PASSWORD = process.env.E2E_PASSWORD ?? 'e2e-test-pass-2026';

/** ชื่อขึ้นต้นด้วย "E2E local" ตามกฎข้อมูลทดสอบ และถูกลบทิ้งท้ายสคริปต์ */
const SET_CODE = `E2E-SET-${Date.now()}`;

interface ApiResult<T = unknown> {
  status: number;
  body: T;
}
interface SetLine {
  item_id: number;
  pro_code: string;
  unit_level: number;
  unit_name: string;
  qty: number;
  is_gift: boolean;
  line_total: number;
}
interface SetView {
  set_code: string;
  set_name: string;
  price: number;
  list_total: number;
  savings: number;
  items: SetLine[];
  gifts: SetLine[];
  availability: { available_sets: number; limiting_pro_code: string | null };
}
interface AdminSetRow {
  set_code: string;
  set_name: string;
  status: boolean;
}
interface ResolvedItem {
  item_id: number;
  ref_type: string;
  ref_id: string;
  unavailable: boolean;
  payload: unknown;
}
interface CollectionView {
  collection_id: number;
  name: string;
  items: ResolvedItem[];
}
interface MyCollections {
  collections: CollectionView[];
  total_items: number;
}
interface HotdealPayload {
  id: number;
  special_deal: boolean;
  pro1_amount: string;
  pro1_unit: string;
  pro1_unit_name: string;
  pro2_amount: string;
  pro2_unit: string;
  pro2_unit_name: string;
  product: { pro_code: string; pro_name: string } | null;
  product2: { pro_code: string; pro_name: string } | null;
}

let token = '';

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

describe('หน้าแอดมินของชุดสินค้าพิเศษ (e2e)', () => {
  /** สินค้าตัวอย่างหยิบจากกระเช้าที่เปิดขายอยู่ — การันตีว่ามีหน่วยและมีราคา */
  let sample: SetLine;

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

    const sets = await call<SetView[]>('GET', '/ecom/bundle-set');
    expect(sets.status).toBe(200);
    const usable = (sets.body ?? [])
      .flatMap((set) => set.items)
      .find((line) => line.line_total > 0);
    if (!usable) throw new Error('ไม่มีกระเช้าที่เปิดขายพร้อมสินค้าที่มีราคา');
    sample = usable;
  }, 30_000);

  afterAll(async () => {
    if (token) await call('DELETE', `/admin/bundle-set/${SET_CODE}`);
  });

  it('สร้างกระเช้าสำเร็จรูป ใส่สินค้า แล้วอ่านราคากลับมาได้ครบวง (ticket 12)', async () => {
    const created = await call<AdminSetRow>('POST', '/admin/bundle-set', {
      set_code: SET_CODE,
      set_name: 'E2E local กระเช้าทดสอบ',
      description: 'สร้างจากสเปก e2e ลบทิ้งเมื่อจบ',
      price: 199,
      status: true,
      sort_order: 99,
    });
    expect(created.status).toBeLessThan(300);
    expect(created.body.set_code).toBe(SET_CODE);

    const listed = await call<AdminSetRow[]>('GET', '/admin/bundle-set');
    expect(listed.status).toBe(200);
    expect(listed.body.some((row) => row.set_code === SET_CODE)).toBe(true);

    const added = await call('POST', `/admin/bundle-set/${SET_CODE}/item`, {
      pro_code: sample.pro_code,
      unit_level: sample.unit_level,
      qty: 2,
    });
    expect(added.status).toBeLessThan(300);

    const view = await call<SetView>('GET', `/admin/bundle-set/${SET_CODE}`);
    expect(view.status).toBe(200);
    expect(view.body.price).toBe(199);
    const line = view.body.items.find((l) => l.pro_code === sample.pro_code);
    expect(line).toBeDefined();
    expect(line!.qty).toBe(2);
    // หน้าจอโชว์หน่วยกับมูลค่าปกติของแถวนี้ ถ้าไม่มีสองค่านี้ตารางจะว่าง
    expect(line!.unit_name).toBe(sample.unit_name);
    expect(line!.line_total).toBeGreaterThan(0);
    expect(view.body.list_total).toBeGreaterThan(0);

    const removed = await call(
      'DELETE',
      `/admin/bundle-set/${SET_CODE}/item/${line!.item_id}`,
    );
    expect(removed.status).toBeLessThan(300);

    const after = await call<SetView>('GET', `/admin/bundle-set/${SET_CODE}`);
    expect(after.body.items).toHaveLength(0);
  }, 30_000);

  it('รหัสกระเช้าซ้ำถูกปฏิเสธ ไม่ใช่เขียนทับของเดิมเงียบๆ (ticket 12)', async () => {
    const again = await call('POST', '/admin/bundle-set', {
      set_code: SET_CODE,
      set_name: 'E2E local กระเช้าซ้ำ',
      price: 1,
    });
    expect(again.status).toBe(409);
  }, 20_000);

  it('ดีลพิเศษในคอลเลกชันบอกได้ว่าเป็นดีลอะไรและอยู่หน้าไหน (ticket 10/11)', async () => {
    const collections = await call<MyCollections>(
      'GET',
      '/ecom/special-collection/my',
    );
    expect(collections.status).toBe(200);

    const hotdealItems = (collections.body?.collections ?? [])
      .flatMap((collection) => collection.items ?? [])
      .filter((item) => item.ref_type === 'hotdeal' && !item.unavailable);

    if (hotdealItems.length === 0) {
      console.warn('ข้าม: ไม่มีคอลเลกชันที่ผูก hotdeal ไว้ในฐานนี้');
      return;
    }

    for (const item of hotdealItems) {
      const payload = item.payload as HotdealPayload;
      // ต้องรู้ว่าดีลอยู่ /hotdeal หรือ /buy-more-get-1 ไม่งั้นส่งลูกค้าไปผิดหน้า
      expect(typeof payload.special_deal).toBe('boolean');
      expect(payload.product?.pro_code).toBeTruthy();
      expect(payload.product?.pro_name).toBeTruthy();
      expect(payload.product2?.pro_name).toBeTruthy();
      // ฐานเก็บ pro1_unit เป็นระดับหน่วย (1/2/3) ถ้าไม่แปลงชื่อมาให้
      // การ์ดจะเขียนว่า "ซื้อ 5 1 แถม 1 1"
      expect(payload.pro1_unit_name).toBeTruthy();
      expect(payload.pro1_unit_name).not.toMatch(/^[123]$/);
      expect(payload.pro2_unit_name).toBeTruthy();
      expect(payload.pro2_unit_name).not.toMatch(/^[123]$/);
    }
  }, 30_000);
});
