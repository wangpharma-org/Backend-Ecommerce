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

function isScope(value: unknown): value is CartConsentScope {
  return typeof value === 'string' && scopes.includes(value);
}

function isStatus(value: unknown): value is CartConsentRecord['status'] {
  return typeof value === 'string' && statuses.includes(value);
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

  private async forward(
    method: 'GET' | 'POST',
    path: string,
    token: string,
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
        timeout: 5000,
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

  private isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }
}
