import { UnauthorizedException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController — Sale internal cart endpoint', () => {
  const originalToken = process.env.SALE_ECOMMERCE_INTERNAL_TOKEN;
  const getSaleCartSnapshot = jest.fn();
  const controller = Object.assign(Object.create(AppController.prototype), {
    shoppingCartService: { getSaleCartSnapshot },
  }) as AppController;

  beforeEach(() => {
    getSaleCartSnapshot.mockReset();
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.SALE_ECOMMERCE_INTERNAL_TOKEN;
    } else {
      process.env.SALE_ECOMMERCE_INTERNAL_TOKEN = originalToken;
    }
  });

  it('fails closed when the internal token is not configured', async () => {
    delete process.env.SALE_ECOMMERCE_INTERNAL_TOKEN;

    await expect(
      controller.getSaleCustomerCart('M001', 'provided-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSaleCartSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a missing or mismatched token', async () => {
    process.env.SALE_ECOMMERCE_INTERNAL_TOKEN = 'expected-token';

    await expect(controller.getSaleCustomerCart('M001')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      controller.getSaleCustomerCart('M001', 'wrong-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSaleCartSnapshot).not.toHaveBeenCalled();
  });

  it('rejects a whitespace-only configured token', async () => {
    process.env.SALE_ECOMMERCE_INTERNAL_TOKEN = '   ';
    await expect(
      controller.getSaleCustomerCart('M001', '   '),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(getSaleCartSnapshot).not.toHaveBeenCalled();
  });

  it('returns the read-only snapshot for a matching internal token', async () => {
    const snapshot = {
      cart: [],
      cartVersion: '4',
      cartSyncedAt: null,
    };
    process.env.SALE_ECOMMERCE_INTERNAL_TOKEN = 'expected-token';
    getSaleCartSnapshot.mockResolvedValue(snapshot);

    await expect(
      controller.getSaleCustomerCart('M001', 'expected-token'),
    ).resolves.toBe(snapshot);
    expect(getSaleCartSnapshot).toHaveBeenCalledWith('M001');
  });
});
