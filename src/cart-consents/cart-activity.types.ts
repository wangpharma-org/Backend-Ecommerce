import { BadGatewayException, BadRequestException } from '@nestjs/common';
import type { SaleCartChange } from './cart-mutation.types';

// What a customer sees of the Sale cart audit log (SSN0-177): who did what, when.
export const CART_ACTIVITY_ACTIONS = [
  'CONSENT_REQUESTED',
  'CONSENT_ACCEPTED',
  'CONSENT_REJECTED',
  'CONSENT_REVOKED',
  'SESSION_REQUESTED',
  'SESSION_NOTIFIED',
  'SESSION_ACCEPTED',
  'SESSION_REJECTED',
  'SESSION_STOPPED',
  'CART_PRODUCT_ADDED',
  'CART_QUANTITY_CHANGED',
  'CART_PRODUCT_REMOVED',
  'ORDER_REQUESTED',
] as const;

export type CartActivityAction = (typeof CART_ACTIVITY_ACTIONS)[number];

export interface CartActivityItem {
  id: string;
  action: CartActivityAction;
  actorType: 'SALESPERSON' | 'CUSTOMER';
  actorName: string | null;
  salespersonCode: string;
  sessionId: string | null;
  change: SaleCartChange | null;
  createdAt: string;
}

export interface CartActivityPage {
  items: CartActivityItem[];
  latestId: string | null;
}

export interface CartActivityQuery {
  afterId?: string;
  beforeId?: string;
  limit?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

const isNullableString = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';
const isNullableQuantity = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0);

/** Only forwards query values the Sale API accepts; anything else is a 400 here. */
export function toActivityQueryString(query: CartActivityQuery): string {
  const params = new URLSearchParams();
  for (const key of ['afterId', 'beforeId', 'limit'] as const) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string' || !/^[1-9]\d{0,19}$/.test(value))
      throw new BadRequestException(`${key} must be a positive integer`);
    params.set(key, value);
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

function parseChange(details: unknown): SaleCartChange | null {
  if (details === null || details === undefined) return null;
  if (!isRecord(details)) throw new BadGatewayException('Invalid activity');
  const change = details.change;
  if (change === undefined) return null;
  if (
    !isRecord(change) ||
    typeof change.proCode !== 'string' ||
    !isNullableString(change.proName) ||
    !isNullableString(change.unit) ||
    !isNullableQuantity(change.fromQuantity) ||
    !isNullableQuantity(change.toQuantity)
  ) {
    throw new BadGatewayException('Invalid activity');
  }
  return {
    proCode: change.proCode,
    proName: change.proName,
    unit: change.unit,
    fromQuantity: change.fromQuantity,
    toQuantity: change.toQuantity,
  };
}

export function parseCartActivityPage(payload: unknown): CartActivityPage {
  if (
    !isRecord(payload) ||
    !Array.isArray(payload.items) ||
    !isNullableString(payload.latestId)
  ) {
    throw new BadGatewayException('Invalid activity');
  }
  const items = payload.items.map((value: unknown): CartActivityItem => {
    if (
      !isRecord(value) ||
      typeof value.id !== 'string' ||
      !CART_ACTIVITY_ACTIONS.includes(value.action as CartActivityAction) ||
      (value.actorType !== 'SALESPERSON' && value.actorType !== 'CUSTOMER') ||
      !isNullableString(value.actorName) ||
      typeof value.salespersonCode !== 'string' ||
      !isNullableString(value.sessionId) ||
      typeof value.createdAt !== 'string'
    ) {
      throw new BadGatewayException('Invalid activity');
    }
    return {
      id: value.id,
      action: value.action as CartActivityAction,
      actorType: value.actorType,
      actorName: value.actorName,
      salespersonCode: value.salespersonCode,
      sessionId: value.sessionId,
      change: parseChange(value.details),
      createdAt: value.createdAt,
    };
  });
  return { items, latestId: payload.latestId };
}
