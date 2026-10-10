import {
  BadGatewayException,
  ForbiddenException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export type CartConsentScope =
  | 'ADD_PRODUCT'
  | 'CHANGE_QUANTITY'
  | 'REMOVE_PRODUCT'
  | 'PLACE_ORDER';

export interface CartConsentRecord {
  id: string;
  customerCode: string;
  salespersonCode: string;
  scopes: CartConsentScope[];
  durationDays: number;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED';
  requestedAt: string;
  grantedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface CartSessionRecord {
  id: string;
  customerCode: string;
  salespersonCode: string;
  consentId: string;
  scopes: CartConsentScope[];
  status: 'PENDING' | 'ACTIVE' | 'REJECTED' | 'STOPPED' | 'EXPIRED';
  requestedAt: string;
  notifiedAt: string | null;
  respondedAt: string | null;
  expiresAt: string | null;
  endedAt: string | null;
}

export interface CartContact {
  salespersonCode: string | null;
  displayName: string | null;
  email: string | null;
}

const scopes: string[] = [
  'ADD_PRODUCT',
  'CHANGE_QUANTITY',
  'REMOVE_PRODUCT',
  'PLACE_ORDER',
];
const statuses: string[] = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'REVOKED',
  'EXPIRED',
];
const sessionStatuses: string[] = [
  'PENDING',
  'ACTIVE',
  'REJECTED',
  'STOPPED',
  'EXPIRED',
];

function isScope(value: unknown): value is CartConsentScope {
  return typeof value === 'string' && scopes.includes(value);
}

function isStatus(value: unknown): value is CartConsentRecord['status'] {
  return typeof value === 'string' && statuses.includes(value);
}

function isSessionStatus(value: unknown): value is CartSessionRecord['status'] {
  return typeof value === 'string' && sessionStatuses.includes(value);
}

@Injectable()
export class CartConsentGatewayService {
  constructor(private readonly config: ConfigService) {}

  async list(token: string): Promise<CartConsentRecord[]> {
    const payload = await this.forward('GET', '/customer/cart-consents', token);
    if (!Array.isArray(payload))
      throw new BadGatewayException('Invalid consent response');
    return payload.map((value: unknown) => this.parseRecord(value));
  }

  async action(
    token: string,
    id: string,
    action: 'accept' | 'reject' | 'revoke',
  ): Promise<CartConsentRecord> {
    const payload = await this.forward(
      'POST',
      `/customer/cart-consents/${encodeURIComponent(id)}/${action}`,
      token,
    );
    return this.parseRecord(payload);
  }

  async listSessions(token: string): Promise<CartSessionRecord[]> {
    const payload = await this.forward('GET', '/customer/cart-sessions', token);
    if (!Array.isArray(payload))
      throw new BadGatewayException('Invalid cart session response');
    return payload.map((value: unknown) => this.parseSessionRecord(value));
  }

  async getCartContact(token: string): Promise<CartContact> {
    const payload = await this.forward('GET', '/customer/cart-contact', token);
    if (
      !this.isRecord(payload) ||
      !this.isNullableString(payload.salespersonCode) ||
      !this.isNullableString(payload.displayName) ||
      !this.isNullableString(payload.email)
    ) {
      throw new BadGatewayException('Invalid cart contact response');
    }
    return {
      salespersonCode: payload.salespersonCode,
      displayName: payload.displayName,
      email: payload.email,
    };
  }

  async sessionAction(
    token: string,
    id: string,
    action: 'accept' | 'reject' | 'stop',
  ): Promise<CartSessionRecord> {
    const payload = await this.forward(
      'POST',
      `/customer/cart-sessions/${encodeURIComponent(id)}/${action}`,
      token,
      action === 'stop' ? 60000 : 5000,
    );
    return this.parseSessionRecord(payload);
  }

  async assertSalespersonCartRead(
    token: string,
    customerCode: string,
  ): Promise<void> {
    try {
      await this.forward(
        'GET',
        `/customers/${encodeURIComponent(customerCode)}/cart-assignment`,
        token,
      );
    } catch (error: unknown) {
      if (error instanceof HttpException && error.getStatus() < 500) {
        throw new ForbiddenException('Customer cart access denied');
      }
      throw error;
    }
  }

  async assertSalespersonCartMutation(
    token: string,
    customerCode: string,
    sessionId: string,
  ): Promise<void> {
    const payload = await this.forward(
      'GET',
      `/customers/${encodeURIComponent(customerCode)}/cart-sessions/${encodeURIComponent(sessionId)}/mutation-authority`,
      token,
    );
    if (!this.isRecord(payload) || payload.active !== true) {
      throw new BadGatewayException('Invalid cart session authority response');
    }
  }

  async assertSalespersonOrderRequest(
    token: string,
    customerCode: string,
    sessionId: string,
  ): Promise<void> {
    const payload = await this.forward(
      'GET',
      `/customers/${encodeURIComponent(customerCode)}/cart-sessions/${encodeURIComponent(sessionId)}/order-authority`,
      token,
    );
    if (!this.isRecord(payload) || payload.active !== true) {
      throw new BadGatewayException('Invalid order authority response');
    }
  }

  private async forward(
    method: 'GET' | 'POST',
    path: string,
    token: string,
    timeoutMs = 5000,
  ): Promise<unknown> {
    const baseUrl = this.config
      .get<string>('SALE_API_URL')
      ?.trim()
      .replace(/\/+$/, '');
    if (!baseUrl || !/^https?:\/\//.test(baseUrl)) {
      throw new ServiceUnavailableException(
        'Sale consent integration is not configured',
      );
    }
    try {
      const response = await axios.request<unknown>({
        method,
        url: `${baseUrl}${path}`,
        headers: { Authorization: `Bearer ${token}` },
        timeout: timeoutMs,
      });
      return response.data;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const status = error.response.status;
        if (status >= 400 && status < 500) {
          throw new HttpException('Sale consent request rejected', status);
        }
      }
      throw new BadGatewayException('Sale consent service is unavailable');
    }
  }

  private parseRecord(value: unknown): CartConsentRecord {
    if (
      !this.isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.customerCode !== 'string' ||
      typeof value.salespersonCode !== 'string' ||
      !Array.isArray(value.scopes) ||
      typeof value.durationDays !== 'number' ||
      !Number.isInteger(value.durationDays) ||
      !isStatus(value.status) ||
      typeof value.requestedAt !== 'string' ||
      !this.isNullableString(value.grantedAt) ||
      !this.isNullableString(value.expiresAt) ||
      !this.isNullableString(value.revokedAt)
    ) {
      throw new BadGatewayException('Invalid consent response');
    }
    const safeScopes: CartConsentScope[] = [];
    for (const scope of value.scopes) {
      if (!isScope(scope))
        throw new BadGatewayException('Invalid consent response');
      safeScopes.push(scope);
    }
    return {
      id: value.id,
      customerCode: value.customerCode,
      salespersonCode: value.salespersonCode,
      scopes: safeScopes,
      durationDays: value.durationDays,
      status: value.status,
      requestedAt: value.requestedAt,
      grantedAt: value.grantedAt,
      expiresAt: value.expiresAt,
      revokedAt: value.revokedAt,
    };
  }

  private parseSessionRecord(value: unknown): CartSessionRecord {
    if (
      !this.isRecord(value) ||
      typeof value.id !== 'string' ||
      typeof value.customerCode !== 'string' ||
      typeof value.salespersonCode !== 'string' ||
      typeof value.consentId !== 'string' ||
      !Array.isArray(value.scopes) ||
      !isSessionStatus(value.status) ||
      typeof value.requestedAt !== 'string' ||
      !this.isNullableString(value.notifiedAt) ||
      !this.isNullableString(value.respondedAt) ||
      !this.isNullableString(value.expiresAt) ||
      !this.isNullableString(value.endedAt)
    ) {
      throw new BadGatewayException('Invalid cart session response');
    }
    const safeScopes: CartConsentScope[] = [];
    for (const scope of value.scopes) {
      if (!isScope(scope))
        throw new BadGatewayException('Invalid cart session response');
      safeScopes.push(scope);
    }
    return {
      id: value.id,
      customerCode: value.customerCode,
      salespersonCode: value.salespersonCode,
      consentId: value.consentId,
      scopes: safeScopes,
      status: value.status,
      requestedAt: value.requestedAt,
      notifiedAt: value.notifiedAt,
      respondedAt: value.respondedAt,
      expiresAt: value.expiresAt,
      endedAt: value.endedAt,
    };
  }

  private isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
