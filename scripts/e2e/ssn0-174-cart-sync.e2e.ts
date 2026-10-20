/**
 * API-backed SSN0-174 check. Use an isolated customer with active cart consent
 * and a product absent from that customer's cart. This mutates and then cleans
 * the fixture cart; never point it at a real customer.
 * Required: SALE_BASE_URL, ECOM_BASE_URL, SALE_TOKEN, CUSTOMER_TOKEN,
 * TEST_CUSTOMER_CODE, TEST_PRODUCT_CODE, TEST_PRODUCT_UNIT,
 * ISOLATED_TEST_CUSTOMER=YES, ALLOW_CART_MUTATION=YES.
 * Set E2E_ENV=dev|staging|prod for non-local URLs. Tokens are never reported.
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const saleBase = process.env.SALE_BASE_URL ?? 'http://localhost:3001/api/sale';
const ecomBase = process.env.ECOM_BASE_URL ?? 'http://localhost:3000/api';
const saleToken = process.env.SALE_TOKEN ?? '';
const customerToken = process.env.CUSTOMER_TOKEN ?? '';
const customerCode = process.env.TEST_CUSTOMER_CODE ?? '';
const productCode = process.env.TEST_PRODUCT_CODE ?? '';
const productUnit = process.env.TEST_PRODUCT_UNIT ?? '';
const local = [saleBase, ecomBase].every((url) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url),
);
const environment = process.env.E2E_ENV ?? (local ? 'local' : '');

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function claim(token: string, key: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const decoded: unknown = JSON.parse(
      Buffer.from(part, 'base64url').toString('utf8'),
    );
    return isRecord(decoded) && typeof decoded[key] === 'string'
      ? decoded[key]
      : null;
  } catch {
    return null;
  }
}

function cartVersion(value: unknown): string {
  if (!isRecord(value) || typeof value.cartVersion !== 'string') {
    throw new Error('Cart version missing');
  }
  return value.cartVersion;
}

function productQuantity(value: unknown, code: string): number {
  if (!isRecord(value) || !Array.isArray(value.cart))
    throw new Error('Cart missing');
  let total = 0;
  for (const product of value.cart) {
    if (!isRecord(product) || product.pro_code !== code) continue;
    if (!Array.isArray(product.shopping_cart))
      throw new Error('Cart lines missing');
    for (const line of product.shopping_cart) {
      if (!isRecord(line)) throw new Error('Invalid cart line');
      const quantity = Number(line.spc_amount);
      if (!Number.isFinite(quantity)) throw new Error('Invalid cart quantity');
      total += quantity;
    }
  }
  return total;
}

function editableLineId(value: unknown, code: string): number {
  if (!isRecord(value) || !Array.isArray(value.cart))
    throw new Error('Cart missing');
  for (const product of value.cart) {
    if (
      !isRecord(product) ||
      product.pro_code !== code ||
      !Array.isArray(product.shopping_cart)
    )
      continue;
    for (const line of product.shopping_cart) {
      if (
        isRecord(line) &&
        line.editable === true &&
        typeof line.spc_id === 'number'
      )
        return line.spc_id;
    }
  }
  throw new Error('Editable test line missing');
}

async function main(): Promise<void> {
  if (
    process.env.ISOLATED_TEST_CUSTOMER !== 'YES' ||
    process.env.ALLOW_CART_MUTATION !== 'YES' ||
    !saleToken ||
    !customerToken ||
    !customerCode ||
    !productCode ||
    !productUnit ||
    !environment ||
    (environment === 'local' && !local) ||
    claim(customerToken, 'mem_code') !== customerCode ||
    !claim(saleToken, 'emp_code')
  ) {
    throw new Error(
      'Isolated E2E fixture and explicit mutation confirmation required',
    );
  }
  const client = (baseURL: string, token: string) =>
    axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
      timeout: 65000,
    });
  const sale = client(saleBase, saleToken);
  const customer = client(ecomBase, customerToken);
  const salePath = `/customers/${encodeURIComponent(customerCode)}/cart-sessions`;
  const customerPath = '/ecom/cart-sessions';
  const results: Array<{ step: string; status: number; ok: boolean }> = [];
  let sessionId: string | null = null;
  let active = false;
  let stopped = false;
  let fixtureAdded = false;
  const check = (step: string, status: number, expected: number): void => {
    const ok = status === expected;
    results.push({ step, status, ok });
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${step}: HTTP ${status}\n`);
    if (!ok) throw new Error(`${step} expected HTTP ${expected}`);
  };

  try {
    const assignment = await sale.get<unknown>(
      `/customers/${encodeURIComponent(customerCode)}/cart-assignment`,
    );
    check('assigned salesperson', assignment.status, 200);
    const consents = await customer.get<unknown>('/ecom/cart-consents');
    check('active consent fixture', consents.status, 200);
    if (
      !Array.isArray(consents.data) ||
      !consents.data.some(
        (item: unknown) =>
          isRecord(item) &&
          item.status === 'ACTIVE' &&
          Array.isArray(item.scopes) &&
          item.scopes.includes('ADD_PRODUCT') &&
          item.scopes.includes('CHANGE_QUANTITY'),
      )
    ) {
      throw new Error(
        'Active ADD_PRODUCT and CHANGE_QUANTITY cart consent required',
      );
    }
    const sessions = await customer.get<unknown>(customerPath);
    check('existing sessions', sessions.status, 200);
    if (
      !Array.isArray(sessions.data) ||
      sessions.data.some(
        (item: unknown) =>
          isRecord(item) &&
          (item.status === 'PENDING' || item.status === 'ACTIVE'),
      )
    ) {
      throw new Error('Fixture already has an open session');
    }
    const before = await customer.get<unknown>(
      `/ecom/product-cart/${encodeURIComponent(customerCode)}`,
    );
    check('initial customer cart', before.status, 200);
    if (productQuantity(before.data, productCode) !== 0) {
      throw new Error('Test product must be absent before run');
    }
    const initialVersion = cartVersion(before.data);
    const requested = await sale.post<unknown>(salePath);
    check('request cart session', requested.status, 201);
    if (!isRecord(requested.data) || typeof requested.data.id !== 'string')
      throw new Error('Session ID missing');
    sessionId = requested.data.id;
    let notified = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const list = await customer.get<unknown>(customerPath);
      check(`notice poll ${attempt + 1}`, list.status, 200);
      if (
        Array.isArray(list.data) &&
        list.data.some(
          (item: unknown) =>
            isRecord(item) &&
            item.id === sessionId &&
            typeof item.notifiedAt === 'string',
        )
      ) {
        notified = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!notified) throw new Error('Session notice not queued');
    const accepted = await customer.post<unknown>(
      `${customerPath}/${sessionId}/accept`,
    );
    check('customer confirms session', accepted.status, 201);
    if (!isRecord(accepted.data) || accepted.data.status !== 'ACTIVE')
      throw new Error('Session not active');
    active = true;

    const customerAdd = await customer.post<unknown>('/ecom/product-add-cart', {
      mem_code: customerCode,
      pro_code: productCode,
      pro_unit: productUnit,
      amount: 1,
      flashsale_end: '',
      cartVersion: initialVersion,
    });
    check('customer edits first', customerAdd.status, 201);
    fixtureAdded = true;
    const staleSaleAdd = await sale.post<unknown>(
      `${salePath}/${sessionId}/cart-mutations`,
      {
        kind: 'ADD_PRODUCT',
        proCode: productCode,
        unit: productUnit,
        quantity: 1,
        expectedCartVersion: initialVersion,
      },
    );
    check('stale Sale edit loses to customer', staleSaleAdd.status, 409);

    const customerRemove = await customer.post<unknown>(
      '/ecom/product-delete-cart',
      {
        mem_code: customerCode,
        pro_code: productCode,
      },
    );
    check('customer removes test line', customerRemove.status, 201);

    const refreshed = await sale.get<unknown>(
      `/customers/${encodeURIComponent(customerCode)}/cart`,
    );
    check('Sale reads latest cart', refreshed.status, 200);
    const latestVersion = cartVersion(refreshed.data);
    const saleAdd = await sale.post<unknown>(
      `${salePath}/${sessionId}/cart-mutations`,
      {
        kind: 'ADD_PRODUCT',
        proCode: productCode,
        unit: productUnit,
        quantity: 1,
        expectedCartVersion: latestVersion,
      },
    );
    check('Sale adds product after refresh', saleAdd.status, 201);
    if (productQuantity(saleAdd.data, productCode) !== 1)
      throw new Error('Sale add not synchronized');
    const saleChange = await sale.post<unknown>(
      `${salePath}/${sessionId}/cart-mutations`,
      {
        kind: 'CHANGE_QUANTITY',
        lineId: editableLineId(saleAdd.data, productCode),
        proCode: productCode,
        unit: productUnit,
        quantity: 2,
        expectedCartVersion: cartVersion(saleAdd.data),
      },
    );
    check('Sale changes quantity after refresh', saleChange.status, 201);
    if (productQuantity(saleChange.data, productCode) !== 2)
      throw new Error('Sale quantity not synchronized');
    const stop = await customer.post<unknown>(
      `${customerPath}/${sessionId}/stop`,
    );
    check('customer override stops Sale', stop.status, 201);
    stopped = true;
    active = false;
    const afterStop = await sale.post<unknown>(
      `${salePath}/${sessionId}/cart-mutations`,
      {
        kind: 'ADD_PRODUCT',
        proCode: productCode,
        unit: productUnit,
        quantity: 1,
        expectedCartVersion: cartVersion(saleChange.data),
      },
    );
    check('Sale edit denied after override', afterStop.status, 403);
    const retained = await customer.get<unknown>(
      `/ecom/product-cart/${encodeURIComponent(customerCode)}`,
    );
    check('customer sees retained Sale edit', retained.status, 200);
    if (productQuantity(retained.data, productCode) !== 2)
      throw new Error('Sale edit was rolled back');
    const contact = await customer.get<unknown>(`${customerPath}/contact`);
    check('customer can contact Sale', contact.status, 200);
  } finally {
    if (sessionId && !stopped) {
      const action = active ? 'stop' : 'reject';
      const cleanup = await customer
        .post<unknown>(`${customerPath}/${sessionId}/${action}`)
        .catch(() => null);
      stopped = action === 'stop' && cleanup?.status === 201;
    }
    if (fixtureAdded && stopped) {
      await customer
        .post<unknown>('/ecom/product-delete-cart', {
          mem_code: customerCode,
          pro_code: productCode,
        })
        .catch(() => null);
    }
    const report = [
      '# SSN0-174 Cart Sync API E2E',
      '',
      `- environment: ${environment}`,
      `- Sale base: ${saleBase}`,
      `- Ecommerce base: ${ecomBase}`,
      `- commit: ${execSync('git rev-parse --short HEAD').toString().trim()}`,
      `- run at: ${new Date().toISOString()}`,
      `- result: ${results.filter((result) => result.ok).length}/${results.length} passed`,
      `- cleanup attempted: ${fixtureAdded && stopped ? 'yes' : 'no; inspect isolated fixture'}`,
      '',
      '| step | status | result |',
      '|---|---:|---|',
      ...results.map(
        (result) =>
          `| ${result.step} | ${result.status} | ${result.ok ? 'PASS' : 'FAIL'} |`,
      ),
    ].join('\n');
    const directory = join(process.cwd(), 'docs', 'e2e');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, `ssn0-174-${environment}-${Date.now()}.md`),
      report,
    );
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'E2E failed'}\n`,
  );
  process.exitCode = 1;
});
