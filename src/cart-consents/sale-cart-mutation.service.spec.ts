import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { UserEntity } from '../users/users.entity';
import { CartConsentGatewayService } from './cart-consent-gateway.service';
import { SaleCartMutationService } from './sale-cart-mutation.service';

describe('SaleCartMutationService', () => {
  const mutation = {
    kind: 'ADD_PRODUCT' as const,
    proCode: 'P001',
    unit: 'BOX',
    quantity: 2,
    expectedCartVersion: '1',
  };
  const saleUser = { empCode: 'EMP001', platformId: 'sale' };
  const current = { cart: [], cartVersion: '1', cartSyncedAt: null };
  const updated = { cart: [], cartVersion: '2', cartSyncedAt: null };
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    query: jest
      .fn()
      .mockImplementation((sql: string) =>
        Promise.resolve(
          sql.includes('GET_LOCK') ? [{ acquired: 1 }] : [{ released: 1 }],
        ),
      ),
    release: jest.fn().mockResolvedValue(undefined),
  };
  const jwt = { verifyAsync: jest.fn() };
  const cart = {
    getSaleCartSnapshot: jest.fn(),
    addProductCart: jest.fn().mockResolvedValue(updated),
    handleDeleteCart: jest.fn(),
  };
  const users = {
    findOne: jest
      .fn()
      .mockResolvedValue({ mem_code: 'M001', mem_price: 'C', mem_route: 'R' }),
  };
  const consent = {
    assertSalespersonCartMutation: jest.fn().mockResolvedValue(undefined),
  };
  let service: SaleCartMutationService;

  beforeEach(async () => {
    jest.clearAllMocks();
    jwt.verifyAsync.mockResolvedValue({
      purpose: 'sale-cart-mutation',
      customerCode: 'M001',
      sessionId: 'session-1',
      salespersonCode: 'EMP001',
      mutation,
    });
    cart.getSaleCartSnapshot
      .mockReset()
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(updated);
    const module = await Test.createTestingModule({
      providers: [
        SaleCartMutationService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'ACCESS_TOKEN_SECRET' ? 'shared-secret' : undefined,
          },
        },
        { provide: JwtService, useValue: jwt },
        { provide: DataSource, useValue: { createQueryRunner: () => runner } },
        { provide: ShoppingCartService, useValue: cart },
        { provide: CartConsentGatewayService, useValue: consent },
        { provide: getRepositoryToken(UserEntity), useValue: users },
      ],
    }).compile();
    service = module.get(SaleCartMutationService);
  });

  it('requires a matching signed permit and current Sale authority', async () => {
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        undefined,
        'Bearer sale-jwt',
        mutation,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(runner.connect).not.toHaveBeenCalled();
    consent.assertSalespersonCartMutation.mockRejectedValueOnce(
      new ForbiddenException(),
    );
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        mutation,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(cart.addProductCart).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('rejects a stale Sale write and preserves the customer cart', async () => {
    cart.getSaleCartSnapshot
      .mockReset()
      .mockResolvedValue({ ...current, cartVersion: '2' });
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        mutation,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cart.addProductCart).not.toHaveBeenCalled();
    expect(runner.query).toHaveBeenCalledWith('SELECT RELEASE_LOCK(?)', [
      'ecom-cart:M001',
    ]);
  });

  it('fails fast when a customer cart write holds the lock', async () => {
    runner.query.mockImplementationOnce(() =>
      Promise.resolve([{ acquired: 0 }]),
    );
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        mutation,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(consent.assertSalespersonCartMutation).not.toHaveBeenCalled();
    expect(cart.addProductCart).not.toHaveBeenCalled();
    expect(runner.release).toHaveBeenCalled();
  });

  it('reuses the existing cart write and returns the synchronized snapshot', async () => {
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        mutation,
      ),
    ).resolves.toEqual(updated);
    expect(consent.assertSalespersonCartMutation).toHaveBeenCalledWith(
      'sale-jwt',
      'M001',
      'session-1',
    );
    expect(cart.addProductCart).toHaveBeenCalledWith(
      expect.objectContaining({
        mem_code: 'M001',
        pro_code: 'P001',
        pro_unit: 'BOX',
        amount: 2,
        clientVersion: '1',
        ordinaryOnly: true,
        newLineOnly: true,
      }),
    );
    expect(runner.release).toHaveBeenCalled();
  });

  it('does not let ADD_PRODUCT act as CHANGE_QUANTITY', async () => {
    cart.getSaleCartSnapshot.mockReset().mockResolvedValue({
      ...current,
      cart: [
        {
          pro_code: 'P001',
          pro_name: 'Product',
          pro_imgmain: null,
          shopping_cart: [
            {
              spc_id: 7,
              spc_amount: '1',
              spc_unit: 'BOX',
              spc_checked: 1,
              editable: true,
            },
          ],
        },
      ],
    });
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        mutation,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cart.addProductCart).not.toHaveBeenCalled();
  });

  it('changes only the selected editable line by its quantity delta', async () => {
    const change = {
      kind: 'CHANGE_QUANTITY' as const,
      lineId: 7,
      proCode: 'P001',
      unit: 'BOX',
      quantity: 3,
      expectedCartVersion: '1',
    };
    jwt.verifyAsync.mockResolvedValue({
      purpose: 'sale-cart-mutation',
      customerCode: 'M001',
      sessionId: 'session-1',
      salespersonCode: 'EMP001',
      mutation: change,
    });
    cart.getSaleCartSnapshot
      .mockReset()
      .mockResolvedValueOnce({
        ...current,
        cart: [
          {
            pro_code: 'P001',
            pro_name: 'Product',
            pro_imgmain: null,
            shopping_cart: [
              {
                spc_id: 7,
                spc_amount: '1',
                spc_unit: 'BOX',
                spc_checked: 1,
                editable: true,
              },
            ],
          },
        ],
      })
      .mockResolvedValueOnce(updated);
    await expect(
      service.mutate(
        'M001',
        'session-1',
        saleUser,
        'permit',
        'Bearer sale-jwt',
        change,
      ),
    ).resolves.toEqual(updated);
    expect(cart.addProductCart).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 2,
        ordinaryOnly: true,
      }),
    );
    expect(cart.addProductCart).not.toHaveBeenCalledWith(
      expect.objectContaining({ newLineOnly: true }),
    );
  });
});
