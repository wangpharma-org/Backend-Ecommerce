/**
 * API-backed SSN0-175 check. Creates a REAL order for an isolated E2E customer.
 * Requires active PLACE_ORDER consent/session, a nonempty cart and saved address.
 * Set SALE_BASE_URL, ECOM_BASE_URL, SALE_TOKEN, CUSTOMER_TOKEN,
 * OTHER_CUSTOMER_TOKEN, TEST_CUSTOMER_CODE, TEST_SESSION_ID, TEST_ADDRESS_ID,
 * TEST_SHARED_JWT_SECRET and ALLOW_REAL_ORDER=YES. Set E2E_ENV for remote URLs.
 * Never use a real customer. Tokens, OTP and review URL are never reported.
 */
import axios from 'axios';
import { JwtService } from '@nestjs/jwt';
import { execSync } from 'child_process';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

const saleBase = process.env.SALE_BASE_URL ?? 'http://localhost:3001/api/sale';
const ecomBase = process.env.ECOM_BASE_URL ?? 'http://localhost:3000/api';
const saleToken = process.env.SALE_TOKEN ?? '';
const customerToken = process.env.CUSTOMER_TOKEN ?? '';
const otherToken = process.env.OTHER_CUSTOMER_TOKEN ?? '';
const customerCode = process.env.TEST_CUSTOMER_CODE ?? '';
const sessionId = process.env.TEST_SESSION_ID ?? '';
const addressId = Number(process.env.TEST_ADDRESS_ID);
const secret = process.env.TEST_SHARED_JWT_SECRET ?? '';
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
    const value = isRecord(decoded) ? decoded[key] : null;
    return typeof value === 'string' ? value : null;
  } catch {
    return null;
  }
}

function field(value: unknown, key: string): string {
  const item = isRecord(value) ? value[key] : null;
  if (typeof item !== 'string' || !item)
    throw new Error(`Missing ${key} in API response`);
  return item;
}

async function main(): Promise<void> {
  if (
    process.env.ALLOW_REAL_ORDER !== 'YES' ||
    !/^E2E[-_]/i.test(customerCode) ||
    !/^[0-9a-f-]{36}$/i.test(sessionId) ||
    !Number.isSafeInteger(addressId) ||
    addressId < 1 ||
    !secret ||
    !environment ||
    (environment === 'local' && !local) ||
    (local && environment !== 'local') ||
    claim(customerToken, 'mem_code') !== customerCode ||
    !claim(saleToken, 'emp_code') ||
    !claim(otherToken, 'mem_code') ||
    claim(otherToken, 'mem_code') === customerCode
  ) {
    throw new Error('Invalid isolated fixture or explicit real-order flag');
  }

  const sale = axios.create({
    baseURL: saleBase,
    headers: { Authorization: `Bearer ${saleToken}` },
    validateStatus: () => true,
    timeout: 20000,
  });
  const ecomSale = axios.create({
    baseURL: ecomBase,
    headers: { Authorization: `Bearer ${saleToken}` },
    validateStatus: () => true,
    timeout: 20000,
  });
  const customer = axios.create({
    baseURL: ecomBase,
    headers: { Authorization: `Bearer ${customerToken}` },
    validateStatus: () => true,
    timeout: 40000,
  });
  const outsider = axios.create({
    baseURL: ecomBase,
    headers: { Authorization: `Bearer ${otherToken}` },
    validateStatus: () => true,
    timeout: 20000,
  });
  const salePath = `/customers/${encodeURIComponent(customerCode)}`;
  const ecomPath = `/ecom/internal/sale/customers/${encodeURIComponent(customerCode)}`;
  const customerPath = '/ecom/sale-order-requests';
  const results: Array<{ step: string; status: number; ok: boolean }> = [];
  let createdId = '';
  let reviewToken = '';
  let confirmed = false;
  const check = (step: string, actual: number, expected: number) => {
    const ok = actual === expected;
    results.push({ step, status: actual, ok });
    process.stdout.write(`${ok ? 'PASS' : 'FAIL'} ${step}: HTTP ${actual}\n`);
    if (!ok) throw new Error(`${step} expected HTTP ${expected}`);
  };

  try {
    const authority = await sale.get<unknown>(
      `${salePath}/cart-sessions/${sessionId}/order-authority`,
    );
    check('active order authority', authority.status, 200);
    const options = await sale.get<unknown>(`${salePath}/order-options`);
    check('saved checkout options', options.status, 200);
    if (
      !isRecord(options.data) ||
      !Array.isArray(options.data.addresses) ||
      !options.data.addresses.some(
        (address: unknown) => isRecord(address) && address.id === addressId,
      )
    ) {
      throw new Error('Test address is not owned by customer');
    }
    const cart = await ecomSale.get<unknown>(`${ecomPath}/cart`);
    check('current cart snapshot', cart.status, 200);
    const cartVersion = field(cart.data, 'cartVersion');
    if (
      !isRecord(cart.data) ||
      !Array.isArray(cart.data.cart) ||
      !cart.data.cart.some(
        (product: unknown) =>
          isRecord(product) &&
          Array.isArray(product.shopping_cart) &&
          product.shopping_cart.some(
            (line: unknown) => isRecord(line) && line.spc_checked === 1,
          ),
      )
    ) {
      throw new Error('Test cart is empty');
    }
    const history = await sale.get<unknown>(`${salePath}/order-requests`);
    check('order request history', history.status, 200);
    if (
      !Array.isArray(history.data) ||
      history.data.some(
        (item: unknown) => isRecord(item) && item.status === 'PENDING',
      )
    ) {
      throw new Error('Test customer already has a pending order request');
    }

    const input = {
      expectedCartVersion: cartVersion,
      addressId,
      shippingOption: 'wang',
      paymentOption: 'bank-transfer',
    };
    const permit = await new JwtService().signAsync(
      {
        purpose: 'sale-order-request',
        customerCode,
        sessionId,
        salespersonCode: claim(saleToken, 'emp_code'),
        input,
      },
      {
        secret,
        algorithm: 'HS256',
        expiresIn: '15s',
        audience: 'ecom-sale-order',
        issuer: 'sale-service',
      },
    );
    const created = await ecomSale.post<unknown>(
      `${ecomPath}/cart-sessions/${sessionId}/order-requests`,
      input,
      { headers: { 'X-Sale-Order-Permit': permit } },
    );
    check('create pending order, no real order yet', created.status, 201);
    createdId = field(created.data, 'id');
    reviewToken = field(created.data, 'reviewToken');
    const otp = field(created.data, 'otp');
    if (
      !/^\d{6}$/.test(otp) ||
      !isRecord(created.data) ||
      created.data.status !== 'PENDING'
    ) {
      throw new Error('Pending order contract is invalid');
    }

    const saleCreate = await sale.post<unknown>(
      `${salePath}/cart-sessions/${sessionId}/order-requests`,
      input,
    );
    check(
      'Sale queues notice and returns safe summary',
      saleCreate.status,
      201,
    );
    if (
      !isRecord(saleCreate.data) ||
      saleCreate.data.id !== createdId ||
      'otp' in saleCreate.data ||
      'reviewToken' in saleCreate.data
    ) {
      throw new Error('Sale returned an unsafe order response');
    }

    const headers = { 'X-Sale-Order-Token': reviewToken };
    const path = `${customerPath}/${createdId}`;
    const outsiderReview = await outsider.get<unknown>(path, { headers });
    check('other customer cannot review', outsiderReview.status, 404);
    const review = await customer.get<unknown>(path, { headers });
    check('customer reviews pending order', review.status, 200);
    if (
      !isRecord(review.data) ||
      review.data.status !== 'PENDING' ||
      review.data.confirmedOrderNumbers !== null
    ) {
      throw new Error('Real order exists before customer approval');
    }
    const wrongOtp = otp === '000000' ? '000001' : '000000';
    const wrong = await customer.post<unknown>(
      `${path}/confirm`,
      { otp: wrongOtp },
      { headers },
    );
    check('wrong OTP cannot confirm', wrong.status, 403);
    const accepted = await customer.post<unknown>(
      `${path}/confirm`,
      { otp },
      { headers },
    );
    check('valid OTP confirms order', accepted.status, 201);
    const confirmedReview = await customer.get<unknown>(path, { headers });
    check('confirmed order is visible', confirmedReview.status, 200);
    const numbers = isRecord(confirmedReview.data)
      ? confirmedReview.data.confirmedOrderNumbers
      : null;
    if (
      !isRecord(confirmedReview.data) ||
      confirmedReview.data.status !== 'CONFIRMED' ||
      !Array.isArray(numbers) ||
      numbers.length === 0 ||
      !numbers.every((number: unknown) => typeof number === 'string')
    ) {
      throw new Error('Confirmed order numbers are missing');
    }
    confirmed = true;
    const duplicate = await customer.post<unknown>(
      `${path}/confirm`,
      { otp },
      { headers },
    );
    check('duplicate confirmation is idempotent', duplicate.status, 201);
    if (
      !isRecord(duplicate.data) ||
      JSON.stringify(duplicate.data.confirmedOrderNumbers) !==
        JSON.stringify(numbers)
    ) {
      throw new Error('Duplicate confirmation changed order numbers');
    }
    const latestHistory = await sale.get<unknown>(`${salePath}/order-requests`);
    check('Sale sees confirmed status', latestHistory.status, 200);
    if (
      !Array.isArray(latestHistory.data) ||
      !latestHistory.data.some(
        (item: unknown) =>
          isRecord(item) &&
          item.id === createdId &&
          item.status === 'CONFIRMED',
      )
    ) {
      throw new Error('Sale history did not update');
    }
  } finally {
    if (createdId && reviewToken && !confirmed) {
      await customer
        .post<unknown>(
          `${customerPath}/${createdId}/reject`,
          {},
          { headers: { 'X-Sale-Order-Token': reviewToken } },
        )
        .catch(() => undefined);
    }
    const report = [
      '# SSN0-175 Sales Order API E2E',
      '',
      `- environment: ${environment}`,
      `- Sale base: ${saleBase}`,
      `- Ecommerce base: ${ecomBase}`,
      `- Ecommerce commit: ${execSync('git rev-parse --short HEAD').toString().trim()}`,
      `- run at: ${new Date().toISOString()}`,
      `- result: ${results.filter((item) => item.ok).length}/${results.length} passed`,
      '- notification: queue response checked; provider delivery requires manual verification',
      '',
      '| step | status | result |',
      '|---|---:|---|',
      ...results.map(
        (item) =>
          `| ${item.step} | ${item.status} | ${item.ok ? 'PASS' : 'FAIL'} |`,
      ),
    ].join('\n');
    const directory = join(process.cwd(), 'docs', 'e2e');
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      join(directory, `ssn0-175-${environment}-${Date.now()}.md`),
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
