import { ForbiddenException } from '@nestjs/common';
import { AppController } from './app.controller';

describe('AppController — Sale cart access', () => {
  const getSaleCartSnapshot = jest.fn();
  const assertSalespersonCartRead = jest.fn();
  const controller = Object.assign(Object.create(AppController.prototype), {
    shoppingCartService: { getSaleCartSnapshot },
    cartConsentGatewayService: { assertSalespersonCartRead },
  }) as AppController;

  beforeEach(() => {
    getSaleCartSnapshot.mockReset();
    assertSalespersonCartRead.mockReset();
  });

  it('rejects missing Sale bearer credentials before reading a cart', async () => {
    await expect(controller.getSaleCustomerCart('M001')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(assertSalespersonCartRead).not.toHaveBeenCalled();
    expect(getSaleCartSnapshot).not.toHaveBeenCalled();
  });

  it('requires live Sale assignment before returning a read-only snapshot', async () => {
    const snapshot = { cart: [], cartVersion: '4', cartSyncedAt: null };
    assertSalespersonCartRead.mockResolvedValue(undefined);
    getSaleCartSnapshot.mockResolvedValue(snapshot);

    await expect(
      controller.getSaleCustomerCart(' M001 ', 'Bearer sale-jwt'),
    ).resolves.toBe(snapshot);
    expect(assertSalespersonCartRead).toHaveBeenCalledWith('sale-jwt', 'M001');
    expect(getSaleCartSnapshot).toHaveBeenCalledWith('M001');
  });

  it('does not read the cart when Sale denies assignment', async () => {
    assertSalespersonCartRead.mockRejectedValue(new ForbiddenException());
    await expect(
      controller.getSaleCustomerCart('M001', 'Bearer sale-jwt'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(getSaleCartSnapshot).not.toHaveBeenCalled();
  });
});
