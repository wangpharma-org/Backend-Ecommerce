/**
 * API-backed SSN0-172 check against an isolated customer fixture.
 * Set SALE_BASE_URL, ECOM_BASE_URL, SALE_TOKEN, CUSTOMER_TOKEN,
 * OTHER_CUSTOMER_TOKEN, TEST_CUSTOMER_CODE and ALLOW_CONSENT_MUTATION=YES.
 * Set E2E_ENV=dev|staging|prod for non-local URLs. Never use a real customer.
 * This creates and then revokes a consent; it never prints tokens or IDs.
 */
import axios from 'axios';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const saleBase = process.env.SALE_BASE_URL ?? 'http://localhost:3001/api/sale';
const ecomBase = process.env.ECOM_BASE_URL ?? 'http://localhost:3000/api';
const saleToken = process.env.SALE_TOKEN ?? '';
const customerToken = process.env.CUSTOMER_TOKEN ?? '';
const otherCustomerToken = process.env.OTHER_CUSTOMER_TOKEN ?? '';
const customerCode = process.env.TEST_CUSTOMER_CODE ?? '';
const local = [saleBase, ecomBase].every((url) =>
  /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(url),
);
const environment = process.env.E2E_ENV ?? (local ? 'local' : '');

function claim(token: string, key: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const decoded: unknown = JSON.parse(
      Buffer.from(part, 'base64url').toString('utf8'),
    );
    if (isRecord(decoded)) {
      const value = decoded[key];
      return typeof value === 'string' ? value : null;
    }
    return null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function recordId(value: unknown): string | null {
  return isRecord(value) && typeof value.id === 'string' ? value.id : null;
}

async function main(): Promise<void> {
  if (
    process.env.ALLOW_CONSENT_MUTATION !== 'YES' ||
    !saleToken ||
    !customerToken ||
    !otherCustomerToken ||
    !customerCode ||
    !environment ||
    (environment === 'local' && !local) ||
    claim(customerToken, 'mem_code') !== customerCode ||
    !claim(saleToken, 'emp_code') ||
    !claim(otherCustomerToken, 'mem_code') ||
    claim(otherCustomerToken, 'mem_code') === customerCode
  ) {
    throw new Error(
      'Invalid isolated E2E fixture or explicit mutation confirmation',
    );
  }

  const sale = axios.create({
    baseURL: saleBase,
    headers: { Authorization: `Bearer ${saleToken}` },
    validateStatus: () => true,
    timeout: 15000,
  });
  const customer = axios.create({
    baseURL: ecomBase,
    headers: { Authorization: `Bearer ${customerToken}` },
    validateStatus: () => true,
    timeout: 15000,
  });
  const other = axios.create({
    baseURL: ecomBase,
    headers: { Authorization: `Bearer ${otherCustomerToken}` },
    validateStatus: () => true,
    timeout: 15000,
  });
  const salePath = `/customers/${encodeURIComponent(customerCode)}/cart-consents`;
  const ecomPath = '/ecom/cart-consents';
  const results: Array<{ step: string; ok: boolean; status: number }> = [];
  let createdId: string | null = null;
  let status = 'PENDING';
  const check = (step: string, actual: number, expected: number) => {
    const ok = actual === expected;
    results.push({ step, ok, status: actual });
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${step}: HTTP ${actual}\n`);
    if (!ok) throw new Error(`${step} expected HTTP ${expected}`);
  };

  try {
    const assignment = await sale.get<unknown>(
      `/customers/${encodeURIComponent(customerCode)}/cart-assignment`,
    );
    check('assigned salesperson', assignment.status, 200);
    const existing = await customer.get<unknown>(ecomPath);
    check('customer consent list', existing.status, 200);
    if (
      !Array.isArray(existing.data) ||
      existing.data.some(
        (item: unknown) =>
          isRecord(item) &&
          (item.status === 'PENDING' || item.status === 'ACTIVE'),
      )
    ) {
      throw new Error('Fixture already has pending or active consent');
    }

    const request = await sale.post<unknown>(salePath, {
      scopes: ['ADD_PRODUCT', 'CHANGE_QUANTITY'],
      durationDays: 30,
    });
    check('create request', request.status, 201);
    createdId = recordId(request.data);
    if (!createdId) throw new Error('Consent ID missing');
    const duplicate = await sale.post<unknown>(salePath, {
      scopes: ['ADD_PRODUCT'],
      durationDays: 30,
    });
    check('duplicate blocked', duplicate.status, 409);
    const outsider = await other.post<unknown>(
      `${ecomPath}/${createdId}/accept`,
    );
    check('other customer denied', outsider.status, 404);
    const accepted = await customer.post<unknown>(
      `${ecomPath}/${createdId}/accept`,
    );
    check('customer accepts', accepted.status, 201);
    status = 'ACTIVE';
    if (!isRecord(accepted.data) || accepted.data.status !== 'ACTIVE')
      throw new Error('Consent not active');
    const revoked = await customer.post<unknown>(
      `${ecomPath}/${createdId}/revoke`,
    );
    check('customer revokes', revoked.status, 201);
    status = 'REVOKED';
    if (!isRecord(revoked.data) || revoked.data.status !== 'REVOKED')
      throw new Error('Consent not revoked');
  } finally {
    if (createdId && status !== 'REVOKED') {
      const cleanupAction = status === 'ACTIVE' ? 'revoke' : 'reject';
      await customer
        .post<unknown>(`${ecomPath}/${createdId}/${cleanupAction}`)
        .catch(() => undefined);
    }
    const report = [
      '# SSN0-172 Consent API E2E',
      '',
      `- environment: ${environment}`,
      `- Sale base: ${saleBase}`,
      `- Ecommerce base: ${ecomBase}`,
      `- commit: ${execSync('git rev-parse --short HEAD').toString().trim()}`,
      `- run at: ${new Date().toISOString()}`,
      `- result: ${results.filter((result) => result.ok).length}/${results.length} passed`,
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
      join(directory, `ssn0-172-${environment}-${Date.now()}.md`),
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
