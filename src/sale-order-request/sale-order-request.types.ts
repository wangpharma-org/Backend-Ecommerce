import { BadRequestException } from '@nestjs/common';

export const SALE_ORDER_SHIPPING_OPTIONS = [
  'wang',
  'flash',
  'DHL',
  'pickUpUrself',
] as const;

export const SALE_ORDER_PAYMENT_OPTIONS = [
  'wang-credit',
  'check',
  'bank-transfer',
] as const;

export type SaleOrderShippingOption =
  (typeof SALE_ORDER_SHIPPING_OPTIONS)[number];
export type SaleOrderPaymentOption =
  (typeof SALE_ORDER_PAYMENT_OPTIONS)[number];

export interface SaleOrderRequestInput {
  expectedCartVersion: string;
  addressId: number;
  shippingOption: SaleOrderShippingOption;
  paymentOption: SaleOrderPaymentOption;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isShippingOption(value: unknown): value is SaleOrderShippingOption {
  return (
    typeof value === 'string' &&
    SALE_ORDER_SHIPPING_OPTIONS.some((option) => option === value)
  );
}

function isPaymentOption(value: unknown): value is SaleOrderPaymentOption {
  return (
    typeof value === 'string' &&
    SALE_ORDER_PAYMENT_OPTIONS.some((option) => option === value)
  );
}

export function parseSaleOrderRequestInput(
  value: unknown,
): SaleOrderRequestInput {
  if (
    !isRecord(value) ||
    typeof value.expectedCartVersion !== 'string' ||
    !/^\d{1,20}$/.test(value.expectedCartVersion) ||
    typeof value.addressId !== 'number' ||
    !Number.isSafeInteger(value.addressId) ||
    value.addressId < 1 ||
    !isShippingOption(value.shippingOption) ||
    !isPaymentOption(value.paymentOption)
  ) {
    throw new BadRequestException('Invalid pending order request');
  }
  return {
    expectedCartVersion: value.expectedCartVersion,
    addressId: value.addressId,
    shippingOption: value.shippingOption,
    paymentOption: value.paymentOption,
  };
}
