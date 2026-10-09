import {
  BadGatewayException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { CartConsentGatewayService } from './cart-consent-gateway.service';

describe('CartConsentGatewayService', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'SALE_API_URL' ? 'https://sale.example/api/sale/' : undefined,
    ),
  };
  let service: CartConsentGatewayService;
  let requestSpy: jest.SpyInstance;

  beforeEach(async () => {
    config.get.mockClear();
    requestSpy = jest.spyOn(axios, 'request');
    const module = await Test.createTestingModule({
      providers: [
        CartConsentGatewayService,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    service = module.get(CartConsentGatewayService);
  });

  afterEach(() => requestSpy.mockRestore());

  it('forwards a customer token and narrows the Sale response', async () => {
    requestSpy.mockResolvedValue({
      data: [
        {
          id: 'uuid',
          customerCode: 'M001',
          salespersonCode: 'E001',
          scopes: ['ADD_PRODUCT'],
          durationDays: 30,
          status: 'PENDING',
          requestedAt: '2026-10-09T00:00:00.000Z',
          grantedAt: null,
          expiresAt: null,
          revokedAt: null,
          secret: 'not forwarded',
        },
      ],
    });
    await expect(service.list('customer-jwt')).resolves.toEqual([
      {
        id: 'uuid',
        customerCode: 'M001',
        salespersonCode: 'E001',
        scopes: ['ADD_PRODUCT'],
        durationDays: 30,
        status: 'PENDING',
        requestedAt: '2026-10-09T00:00:00.000Z',
        grantedAt: null,
        expiresAt: null,
        revokedAt: null,
      },
    ]);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://sale.example/api/sale/customer/cart-consents',
        headers: { Authorization: 'Bearer customer-jwt' },
      }),
    );
  });

  it('rechecks assignment at Sale before a cart read', async () => {
    requestSpy.mockResolvedValue({ data: { assigned: true } });
    await service.assertSalespersonCartRead('sale-jwt', 'M001');
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://sale.example/api/sale/customers/M001/cart-assignment',
        headers: { Authorization: 'Bearer sale-jwt' },
      }),
    );
  });

  it('denies invalid responses and missing configuration', async () => {
    requestSpy.mockResolvedValue({ data: [{ status: 'ACTIVE' }] });
    await expect(service.list('customer-jwt')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    config.get.mockReturnValueOnce(undefined);
    await expect(service.list('customer-jwt')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('fails closed if Sale refuses or is unavailable', async () => {
    requestSpy.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403 },
    });
    await expect(
      service.assertSalespersonCartRead('sale-jwt', 'M001'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    requestSpy.mockRejectedValueOnce(new Error('down'));
    await expect(
      service.assertSalespersonCartRead('sale-jwt', 'M001'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
