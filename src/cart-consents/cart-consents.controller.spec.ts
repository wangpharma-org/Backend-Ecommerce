import { UnauthorizedException } from '@nestjs/common';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import { CartConsentsController } from './cart-consents.controller';
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
