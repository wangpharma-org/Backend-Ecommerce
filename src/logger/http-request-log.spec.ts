import { buildHttpRequestLog } from './http-request-log';

describe('buildHttpRequestLog', () => {
  it('creates a searchable success record for an authenticated cart request', () => {
    const result = buildHttpRequestLog({
      timestamp: new Date('2026-11-11T03:04:05.000Z'),
      durationMs: 42,
      method: 'POST',
      route: '/api/ecom/product-add-cart',
      user: { mem_code: '0582', username: 'store-0582' },
      body: {
        mem_code: 'other-store',
        pro_code: '31080805',
        pro_unit: 'ขวด',
        amount: 1,
        source: 'search',
      },
      statusCode: 201,
    });

    expect(result).toEqual({
      event: 'http_request',
      timestamp: '2026-11-11T03:04:05.000Z',
      durationMs: 42,
      method: 'POST',
      route: '/api/ecom/product-add-cart',
      actor: { memCode: '0582', username: 'store-0582' },
      requestBody: {
        pro_code: '31080805',
        pro_unit: 'ขวด',
        amount: 1,
        source: 'search',
      },
      statusCode: 201,
      success: true,
    });
  });

  it('marks a failed request and leaves actor empty when authentication did not succeed', () => {
    const result = buildHttpRequestLog({
      timestamp: new Date('2026-11-11T03:04:05.000Z'),
      durationMs: 7,
      method: 'GET',
      route: '/api/ecom/orders',
      statusCode: 401,
    });

    expect(result).toEqual({
      event: 'http_request',
      timestamp: '2026-11-11T03:04:05.000Z',
      durationMs: 7,
      method: 'GET',
      route: '/api/ecom/orders',
      actor: null,
      requestBody: undefined,
      statusCode: 401,
      success: false,
    });
  });

  it('never records credentials from a login request', () => {
    const result = buildHttpRequestLog({
      timestamp: new Date('2026-11-11T03:04:05.000Z'),
      durationMs: 19,
      method: 'POST',
      route: '/api/ecom/login',
      body: { username: 'store-0582', password: 'do-not-log-me' },
      statusCode: 200,
    });

    expect(result.requestBody).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain('do-not-log-me');
  });

  it('redacts sensitive fields from any logged request body', () => {
    const result = buildHttpRequestLog({
      timestamp: new Date('2026-11-11T03:04:05.000Z'),
      durationMs: 19,
      method: 'POST',
      route: '/api/ecom/other-safe-route',
      body: {
        product_code: '31080805',
        access_token: 'access-secret',
        refresh_token: 'refresh-secret',
        authorization: 'Bearer header-secret',
        password: 'password-secret',
        address: 'private-address',
      },
      statusCode: 400,
    });

    expect(result.requestBody).toEqual({ product_code: '31080805' });
    expect(JSON.stringify(result)).not.toMatch(
      /access-secret|refresh-secret|header-secret|password-secret|private-address/,
    );
  });

  it('omits unrecognised request fields so future endpoints cannot leak personal data', () => {
    const result = buildHttpRequestLog({
      timestamp: new Date('2026-11-11T03:04:05.000Z'),
      durationMs: 19,
      method: 'POST',
      route: '/api/ecom/other-safe-route',
      body: {
        product_code: '31080805',
        recipient_name: 'Private Customer',
        custom_note: 'Do not expose this value',
      },
      statusCode: 200,
    });

    expect(result.requestBody).toEqual({ product_code: '31080805' });
    expect(JSON.stringify(result)).not.toMatch(
      /Private Customer|Do not expose this value/,
    );
  });
});
