import { UnauthorizedException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import {
  CartConsentsController,
  CartSessionsController,
} from './cart-consents.controller';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { Request } from 'express';

describe('CartConsentsController', () => {
  const gateway = { list: jest.fn(), action: jest.fn() };
  const requestFor = (user: unknown): Request & { user?: unknown } =>
    ({ user }) as Request & { user?: unknown };
  let controller: CartConsentsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CartConsentsController(
      gateway as unknown as CartConsentGatewayService,
    );
  });

  it('forwards only a verified customer bearer token', async () => {
    gateway.list.mockResolvedValue([]);
    await expect(
      controller.list(requestFor({ mem_code: 'M001' }), 'Bearer customer-jwt'),
    ).resolves.toEqual([]);
    expect(gateway.list).toHaveBeenCalledWith('customer-jwt');
  });

  it('rejects Sale claims and missing credentials', () => {
    expect(() =>
      controller.list(requestFor({ emp_code: 'E001' }), 'Bearer sale-jwt'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      controller.list(requestFor({ mem_code: 'M001' }), undefined),
    ).toThrow(UnauthorizedException);
    expect(gateway.list).not.toHaveBeenCalled();
  });
});

describe('CartSessionsController', () => {
  const gateway = { listSessions: jest.fn(), sessionAction: jest.fn() };
  const requestFor = (user: unknown): Request & { user?: unknown } =>
    ({ user }) as Request & { user?: unknown };
  let controller: CartSessionsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new CartSessionsController(
      gateway as unknown as CartConsentGatewayService,
    );
  });

  it('registers the customer-only cart session controller', () => {
    const routePath = (
      name: 'list' | 'accept' | 'reject' | 'stop',
    ): unknown => {
      const method: unknown = Object.getOwnPropertyDescriptor(
        CartSessionsController.prototype,
        name,
      )?.value;
      if (typeof method !== 'function') return undefined;
      const path: unknown = Reflect.getMetadata(PATH_METADATA, method);
      return path;
    };
    expect(Reflect.getMetadata(PATH_METADATA, CartSessionsController)).toBe(
      'ecom/cart-sessions',
    );
    expect(
      Reflect.getMetadata(GUARDS_METADATA, CartSessionsController),
    ).toEqual([JwtAuthGuard]);
    expect(routePath('list')).toBe('/');
    expect(routePath('accept')).toBe(':id/accept');
    expect(routePath('reject')).toBe(':id/reject');
    expect(routePath('stop')).toBe(':id/stop');
  });

  it('forwards the verified customer token for list and actions', async () => {
    gateway.listSessions.mockResolvedValue([]);
    gateway.sessionAction.mockResolvedValue({});
    const request = requestFor({ mem_code: 'M001' });
    await expect(
      controller.list(request, 'Bearer customer-jwt'),
    ).resolves.toEqual([]);
    expect(gateway.listSessions).toHaveBeenCalledWith('customer-jwt');
    for (const action of ['accept', 'reject', 'stop'] as const) {
      await controller[action](request, 'Bearer customer-jwt', 'session-id');
      expect(gateway.sessionAction).toHaveBeenCalledWith(
        'customer-jwt',
        'session-id',
        action,
      );
    }
  });

  it('rejects Sale claims and missing customer credentials', () => {
    expect(() =>
      controller.list(requestFor({ emp_code: 'E001' }), 'Bearer sale-jwt'),
    ).toThrow(UnauthorizedException);
    expect(() =>
      controller.accept(
        requestFor({ mem_code: 'M001', platform_id: 'admin' }),
        'Bearer customer-jwt',
        'session-id',
      ),
    ).toThrow(UnauthorizedException);
    expect(() =>
      controller.stop(
        requestFor({ mem_code: 'M001' }),
        undefined,
        'session-id',
      ),
    ).toThrow(UnauthorizedException);
    expect(gateway.listSessions).not.toHaveBeenCalled();
    expect(gateway.sessionAction).not.toHaveBeenCalled();
  });
});
