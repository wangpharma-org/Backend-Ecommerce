import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { HttpRequestLoggingMiddleware } from './http-request-logging.middleware';

class TestResponse extends EventEmitter {
  statusCode = 201;
}

describe('HttpRequestLoggingMiddleware', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('logs the final response outcome after authentication has populated the request user', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-11-11T03:04:05.000Z'));
    const writeLog = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const request = {
      method: 'POST',
      baseUrl: '/api',
      route: { path: '/ecom/product-add-cart' },
      body: { pro_code: '31080805', pro_unit: 'ขวด', amount: 1 },
    } as unknown as Request & {
      user?: { mem_code: string; username: string };
    };
    const response = new TestResponse() as unknown as Response;
    const next = jest.fn();

    new HttpRequestLoggingMiddleware().use(request, response, next);
    request.user = { mem_code: '0582', username: 'store-0582' };
    jest.advanceTimersByTime(42);
    (response as unknown as TestResponse).emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(writeLog).toHaveBeenCalledWith({
      event: 'http_request',
      timestamp: '2026-11-11T03:04:05.000Z',
      durationMs: 42,
      method: 'POST',
      route: '/api/ecom/product-add-cart',
      actor: { memCode: '0582', username: 'store-0582' },
      requestBody: { pro_code: '31080805', pro_unit: 'ขวด', amount: 1 },
      statusCode: 201,
      success: true,
    });
  });
});
