/**
 * API-backed SSN0-173 check against an isolated customer with ACTIVE cart consent.
 * Set SALE_BASE_URL, ECOM_BASE_URL, SALE_TOKEN, CUSTOMER_TOKEN,
 * OTHER_CUSTOMER_TOKEN, TEST_CUSTOMER_CODE and ALLOW_SESSION_MUTATION=YES.
 * Set E2E_ENV=dev|staging|prod for non-local URLs. Never use a real customer.
 * Creates a session, accepts it as the customer, and stops it in finally.
 * Tokens and session IDs are never printed or written to the report.
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
    if (!isRecord(decoded)) return null;
    const value = decoded[key];
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function recordId(value: unknown): string | null {
  return isRecord(value) && typeof value.id === 'string' ? value.id : null;
}

function hasStatus(value: unknown, status: string): boolean {
  return isRecord(value) && value.status === status;
}

async function main(): Promise<void> {
  if (
    process.env.ALLOW_SESSION_MUTATION !== 'YES' ||
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

  const client = (token: string, baseURL: string) =>
    axios.create({
      baseURL,
      headers: { Authorization: `Bearer ${token}` },
      validateStatus: () => true,
      timeout: 15000,
    });
  const sale = client(saleToken, saleBase);
  const customer = client(customerToken, ecomBase);
  const other = client(otherCustomerToken, ecomBase);
  const salePath = `/customers/${encodeURIComponent(customerCode)}/cart-sessions`;
  const ecomPath = '/ecom/cart-sessions';
  const consentPath = '/ecom/cart-consents';
  const results: Array<{ step: string; ok: boolean; status: number }> = [];
  let createdId: string | null = null;
  let status = 'PENDING';
  const check = (step: string, actual: number, expected: number): void => {
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
    const consent = await customer.get<unknown>(consentPath);
    check('customer consent list', consent.status, 200);
    if (
      !Array.isArray(consent.data) ||
      !consent.data.some((item: unknown) => hasStatus(item, 'ACTIVE'))
    ) {
      throw new Error('Fixture requires active cart consent');
    }
    const existing = await customer.get<unknown>(ecomPath);
    check('customer session list', existing.status, 200);
    if (
      !Array.isArray(existing.data) ||
      existing.data.some(
        (item: unknown) =>
          hasStatus(item, 'PENDING') || hasStatus(item, 'ACTIVE'),
      )
    ) {
      throw new Error('Fixture already has an open cart session');
    }

    const request = await sale.post<unknown>(salePath);
    check('create pending session', request.status, 201);
    createdId = recordId(request.data);
    if (!createdId || !hasStatus(request.data, 'PENDING'))
      throw new Error('Pending session response missing');
    const duplicate = await sale.post<unknown>(salePath);
    check('duplicate blocked', duplicate.status, 409);
    const outsider = await other.post<unknown>(
      `${ecomPath}/${createdId}/accept`,
    );
    check('other customer denied', outsider.status, 404);

    let notified = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const list = await customer.get<unknown>(ecomPath);
      check(`customer sees request ${attempt + 1}`, list.status, 200);
      if (
        Array.isArray(list.data) &&
        list.data.some(
          (item: unknown) =>
            isRecord(item) &&
            item.id === createdId &&
            typeof item.notifiedAt === 'string',
        )
      ) {
        notified = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    if (!notified)
      throw new Error('Session notice was not queued within 30 seconds');

    const accepted = await customer.post<unknown>(
      `${ecomPath}/${createdId}/accept`,
    );
    check('customer confirms this session', accepted.status, 201);
    if (!hasStatus(accepted.data, 'ACTIVE'))
      throw new Error('Session not active after customer confirmation');
    status = 'ACTIVE';
    const salesView = await sale.get<unknown>(salePath);
    check('salesperson sees confirmed session', salesView.status, 200);
    if (
      !Array.isArray(salesView.data) ||
      !salesView.data.some(
        (item: unknown) =>
          isRecord(item) && item.id === createdId && item.status === 'ACTIVE',
      )
    ) {
      throw new Error('Sale did not observe confirmed session');
    }
    const stopped = await customer.post<unknown>(
      `${ecomPath}/${createdId}/stop`,
    );
    check('customer stops session', stopped.status, 201);
    status = 'STOPPED';
    if (!hasStatus(stopped.data, 'STOPPED'))
      throw new Error('Session did not stop');
    const repeated = await customer.post<unknown>(
      `${ecomPath}/${createdId}/accept`,
    );
    check('stopped session cannot be approved again', repeated.status, 409);
  } finally {
    if (createdId && status !== 'STOPPED') {
      const cleanupAction = status === 'ACTIVE' ? 'stop' : 'reject';
      await customer
        .post<unknown>(`${ecomPath}/${createdId}/${cleanupAction}`)
        .catch(() => undefined);
    }
    const report = [
      '# SSN0-173 Cart Session API E2E',
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
      join(directory, `ssn0-173-${environment}-${Date.now()}.md`),
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
