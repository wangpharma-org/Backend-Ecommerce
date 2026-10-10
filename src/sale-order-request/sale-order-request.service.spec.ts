import { ConflictException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import { CartConsentGatewayService } from '../cart-consents/cart-consent-gateway.service';
import { SaleCartMutationService } from '../cart-consents/sale-cart-mutation.service';
import { EditAddress } from '../edit-address/edit-address.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { ShoppingOrderService } from '../shopping-order/shopping-order.service';
import { UserEntity } from '../users/users.entity';
import {
  SaleOrderRequestEntity,
  SaleOrderRequestStatus,
} from './sale-order-request.entity';
import { SaleOrderRequestService } from './sale-order-request.service';

describe('SaleOrderRequestService', () => {
  const input = {
    expectedCartVersion: '4',
    addressId: 7,
    shippingOption: 'wang',
    paymentOption: 'wang-credit',
  };
  const actor = { empCode: 'EMP001', platformId: 'SALE' };
  const address = Object.assign(new EditAddress(), {
    id: 7,
    name: 'Branch',
    fullName: 'Buyer',
    mem_address: '123 Road',
    mem_village: '',
    mem_alley: '',
    mem_road: '',
    mem_tumbon: 'Town',
    mem_amphur: 'District',
    mem_province: 'Bangkok',
    mem_post: '10000',
    phoneNumber: '0800000000',
    Note: null,
  });
  const snapshot = {
    cartVersion: '4',
    cartSyncedAt: null,
    cart: [
      {
        pro_code: 'P001',
        pro_name: 'Product',
        pro_imgmain: null,
        shopping_cart: [
          {
            spc_id: 1,
            spc_amount: '1',
            spc_unit: 'BOX',
            spc_checked: 1,
            editable: true,
          },
        ],
      },
    ],
  };
  const config = { get: jest.fn().mockReturnValue('secret') };
  const jwt = {
    verifyAsync: jest.fn().mockResolvedValue({
      purpose: 'sale-order-request',
      customerCode: 'M001',
      sessionId: 'session-id',
      salespersonCode: 'EMP001',
      input,
    }),
  };
  const gateway = {
    assertSalespersonCartRead: jest.fn().mockResolvedValue(undefined),
    assertSalespersonOrderRequest: jest.fn().mockResolvedValue(undefined),
  };
  const mutations = {
    withCartMutationLock: jest.fn(
      (_code: string, run: () => Promise<unknown>) => run(),
    ),
  };
  const cart = {
    getSaleCartSnapshot: jest.fn().mockResolvedValue(snapshot),
    summaryCart: jest.fn().mockResolvedValue({ total: 100 }),
  };
  const orders = { submitOrder: jest.fn().mockResolvedValue(['005-000001']) };
  let savedRequest: SaleOrderRequestEntity | null = null;
  const requests = {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    create: jest.fn((value: Partial<SaleOrderRequestEntity>) =>
      Object.assign(new SaleOrderRequestEntity(), value),
    ),
    save: jest.fn((value: SaleOrderRequestEntity) => {
      savedRequest = Object.assign(value, { id: 'request-id' });
      return Promise.resolve(savedRequest);
    }),
  };
  const users = {
    findOne: jest.fn().mockResolvedValue({ mem_code: 'M001', mem_price: 'A' }),
  };
  const addresses = { findOne: jest.fn().mockResolvedValue(address) };
  let service: SaleOrderRequestService;

  beforeEach(() => {
    jest.clearAllMocks();
    savedRequest = null;
    service = new SaleOrderRequestService(
      config as unknown as ConfigService,
      jwt as unknown as JwtService,
      gateway as unknown as CartConsentGatewayService,
      mutations as unknown as SaleCartMutationService,
      cart as unknown as ShoppingCartService,
      orders as unknown as ShoppingOrderService,
      requests as unknown as Repository<SaleOrderRequestEntity>,
      users as unknown as Repository<UserEntity>,
      addresses as unknown as Repository<EditAddress>,
    );
  });

  function getSavedRequest(): SaleOrderRequestEntity {
    if (!savedRequest) throw new Error('Expected a saved request');
    return savedRequest;
  }

  it('creates only a pending request without a real order', async () => {
    const result = await service.create(
      'M001',
      'session-id',
      actor,
      'sale-jwt',
      'permit',
      input,
    );
    expect(result).toMatchObject({
      id: 'request-id',
      status: 'PENDING',
      quotedTotal: '100.00',
    });
    expect(result.otp).toMatch(/^\d{6}$/);
    expect(result.reviewToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(requests.save).toHaveBeenCalledTimes(1);
    expect(gateway.assertSalespersonOrderRequest).toHaveBeenCalledWith(
      'sale-jwt',
      'M001',
      'session-id',
    );
  });

  it('fails closed when the cart changed', async () => {
    cart.getSaleCartSnapshot.mockResolvedValueOnce({
      ...snapshot,
      cartVersion: '5',
    });
    await expect(
      service.create('M001', 'session-id', actor, 'sale-jwt', 'permit', input),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('rejects a forged permit before reading the cart', async () => {
    jwt.verifyAsync.mockResolvedValueOnce({
      purpose: 'sale-order-request',
      customerCode: 'OTHER',
      sessionId: 'session-id',
      salespersonCode: 'EMP001',
      input,
    });
    await expect(
      service.create('M001', 'session-id', actor, 'sale-jwt', 'permit', input),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(mutations.withCartMutationLock).not.toHaveBeenCalled();
  });

  it('requires an address owned by this customer', async () => {
    addresses.findOne.mockResolvedValueOnce(null);
    await expect(
      service.create('M001', 'session-id', actor, 'sale-jwt', 'permit', input),
    ).rejects.toThrow('Address not found');
    expect(requests.save).not.toHaveBeenCalled();
  });

  it('creates one real order only after the customer enters the matching OTP', async () => {
    const created = await service.create(
      'M001',
      'session-id',
      actor,
      'sale-jwt',
      'permit',
      input,
    );
    const entity = getSavedRequest();
    requests.findOne.mockResolvedValue(entity);
    orders.submitOrder.mockImplementationOnce(() => {
      entity.status = SaleOrderRequestStatus.CONFIRMED;
      entity.confirmedOrderNumbers = ['005-000001'];
      return Promise.resolve(['005-000001']);
    });

    await expect(
      service.confirm(entity.id, 'M001', created.reviewToken, created.otp),
    ).resolves.toMatchObject({
      status: SaleOrderRequestStatus.CONFIRMED,
      confirmedOrderNumbers: ['005-000001'],
    });
    await service.confirm(entity.id, 'M001', created.reviewToken, created.otp);
    expect(orders.submitOrder).toHaveBeenCalledTimes(1);
  });

  it('does not submit an order for a wrong OTP', async () => {
    const created = await service.create(
      'M001',
      'session-id',
      actor,
      'sale-jwt',
      'permit',
      input,
    );
    const entity = getSavedRequest();
    requests.findOne.mockResolvedValue(entity);
    await expect(
      service.confirm(
        entity.id,
        'M001',
        created.reviewToken,
        '000000' === created.otp ? '000001' : '000000',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(orders.submitOrder).not.toHaveBeenCalled();
  });

  it('cancels a pending request when the cart changes before confirmation', async () => {
    const created = await service.create(
      'M001',
      'session-id',
      actor,
      'sale-jwt',
      'permit',
      input,
    );
    const entity = getSavedRequest();
    requests.findOne.mockResolvedValue(entity);
    cart.getSaleCartSnapshot.mockResolvedValueOnce({
      ...snapshot,
      cartVersion: '5',
    });
    await expect(
      service.confirm(entity.id, 'M001', created.reviewToken, created.otp),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(orders.submitOrder).not.toHaveBeenCalled();
  });
});
