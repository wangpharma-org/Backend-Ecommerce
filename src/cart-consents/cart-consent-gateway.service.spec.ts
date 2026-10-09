import {
  BadGatewayException,
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import axios from 'axios';
import { CartConsentGatewayService } from './cart-consent-gateway.service';

const session = {
  id: 'f8c4f493-ec30-4ca3-89aa-c3343da4a8af',
  customerCode: 'M001',
  salespersonCode: 'E001',
  consentId: '1c620dbe-83e8-41bf-b638-26c2ea9f0933',
  scopes: ['ADD_PRODUCT'],
  status: 'PENDING',
  requestedAt: '2026-10-09T00:00:00.000Z',
  notifiedAt: null,
  respondedAt: null,
  expiresAt: null,
  endedAt: null,
};

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

  it('rechecks active mutation authority at Sale and validates contact data', async () => {
    requestSpy.mockResolvedValueOnce({ data: { active: true } });
    await service.assertSalespersonCartMutation('sale-jwt', 'M001', session.id);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `https://sale.example/api/sale/customers/M001/cart-sessions/${session.id}/mutation-authority`,
        headers: { Authorization: 'Bearer sale-jwt' },
      }),
    );
    requestSpy.mockResolvedValueOnce({
      data: {
        salespersonCode: 'E001',
        displayName: 'Sale',
        email: 'sale@example.com',
        private: 'hidden',
      },
    });
    await expect(service.getCartContact('customer-jwt')).resolves.toEqual({
      salespersonCode: 'E001',
      displayName: 'Sale',
      email: 'sale@example.com',
    });
    requestSpy.mockResolvedValueOnce({
      data: { salespersonCode: 'E001', displayName: 42, email: null },
    });
    await expect(service.getCartContact('customer-jwt')).rejects.toBeInstanceOf(
      BadGatewayException,
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

  it('lists cart sessions with the same customer bearer token and known fields only', async () => {
    requestSpy.mockResolvedValue({ data: [{ ...session, secret: 'hidden' }] });
    await expect(service.listSessions('customer-jwt')).resolves.toEqual([
      session,
    ]);
    expect(requestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://sale.example/api/sale/customer/cart-sessions',
        headers: { Authorization: 'Bearer customer-jwt' },
      }),
    );
  });

  it.each(['accept', 'reject', 'stop'] as const)(
    'forwards the %s cart session action and validates its response',
    async (action) => {
      requestSpy.mockResolvedValue({ data: { ...session, status: 'ACTIVE' } });
      await expect(
        service.sessionAction('customer-jwt', session.id, action),
      ).resolves.toEqual({ ...session, status: 'ACTIVE' });
      expect(requestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `https://sale.example/api/sale/customer/cart-sessions/${session.id}/${action}`,
          headers: { Authorization: 'Bearer customer-jwt' },
        }),
      );
    },
  );

  it.each([
    { data: {} },
    { data: [{ ...session, endedAt: undefined }] },
    { data: [{ ...session, consentId: null }] },
    { data: [{ ...session, consentId: 5 }] },
    { data: [{ ...session, status: 'REVOKED' }] },
    { data: [{ ...session, scopes: ['UNKNOWN'] }] },
  ])('rejects an invalid cart session list response', async (response) => {
    requestSpy.mockResolvedValue(response);
    await expect(service.listSessions('customer-jwt')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('rejects an invalid cart session action response', async () => {
    requestSpy.mockResolvedValue({ data: { ...session, notifiedAt: 1 } });
    await expect(
      service.sessionAction('customer-jwt', session.id, 'accept'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
