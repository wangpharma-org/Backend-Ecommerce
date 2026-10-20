import { BadRequestException } from '@nestjs/common';

export type CartMutation =
  | {
      kind: 'ADD_PRODUCT';
      proCode: string;
      unit: string;
      quantity: number;
      expectedCartVersion: string;
    }
  | {
      kind: 'CHANGE_QUANTITY';
      lineId: number;
      proCode: string;
      unit: string;
      quantity: number;
      expectedCartVersion: string;
    }
  | {
      kind: 'REMOVE_PRODUCT';
      proCode: string;
      expectedCartVersion: string;
    };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isCode(value: unknown, limit: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= limit
  );
}

function isQuantity(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value > 0 &&
    value <= 999999
  );
}

export function parseCartMutation(value: unknown): CartMutation {
  if (
    !isRecord(value) ||
    !isCode(value.proCode, 20) ||
    typeof value.expectedCartVersion !== 'string' ||
    !/^(0|[1-9]\d{0,19})$/.test(value.expectedCartVersion)
  ) {
    throw new BadRequestException('Invalid cart mutation');
  }
  if (
    value.kind === 'ADD_PRODUCT' &&
    isCode(value.unit, 100) &&
    isQuantity(value.quantity) &&
    Object.keys(value).every((key) =>
      ['kind', 'proCode', 'unit', 'quantity', 'expectedCartVersion'].includes(
        key,
      ),
    )
  ) {
    return {
      kind: 'ADD_PRODUCT',
      proCode: value.proCode,
      unit: value.unit,
      quantity: value.quantity,
      expectedCartVersion: value.expectedCartVersion,
    };
  }
  if (
    value.kind === 'CHANGE_QUANTITY' &&
    typeof value.lineId === 'number' &&
    Number.isSafeInteger(value.lineId) &&
    value.lineId > 0 &&
    isCode(value.unit, 100) &&
    isQuantity(value.quantity) &&
    Object.keys(value).every((key) =>
      [
        'kind',
        'lineId',
        'proCode',
        'unit',
        'quantity',
        'expectedCartVersion',
      ].includes(key),
    )
  ) {
    return {
      kind: 'CHANGE_QUANTITY',
      lineId: value.lineId,
      proCode: value.proCode,
      unit: value.unit,
      quantity: value.quantity,
      expectedCartVersion: value.expectedCartVersion,
    };
  }
  if (
    value.kind === 'REMOVE_PRODUCT' &&
    Object.keys(value).every((key) =>
      ['kind', 'proCode', 'expectedCartVersion'].includes(key),
    )
  ) {
    return {
      kind: 'REMOVE_PRODUCT',
      proCode: value.proCode,
      expectedCartVersion: value.expectedCartVersion,
    };
  }
  throw new BadRequestException('Invalid cart mutation');
}

/** Before/after of one Sale cart mutation, read under the cart lock (SSN0-177 audit, SSN0-176 notice). */
export interface SaleCartChange {
  proCode: string;
  proName: string | null;
  unit: string | null;
  fromQuantity: number | null;
  toQuantity: number | null;
}

interface ChangeSnapshot {
  cart: {
    pro_code: string;
    pro_name: string | null;
    shopping_cart: {
      spc_amount: string;
      spc_unit: string;
      editable: boolean;
    }[];
  }[];
}

function editableQuantity(
  snapshot: ChangeSnapshot,
  proCode: string,
  unit: string,
): number {
  const product = snapshot.cart.find((item) => item.pro_code === proCode);
  return (product?.shopping_cart ?? [])
    .filter((line) => line.editable && line.spc_unit === unit)
    .reduce((sum, line) => sum + (Number(line.spc_amount) || 0), 0);
}

export function describeSaleCartChange(
  mutation: CartMutation,
  before: ChangeSnapshot,
  after: ChangeSnapshot,
): SaleCartChange {
  const proName =
    before.cart.find((item) => item.pro_code === mutation.proCode)?.pro_name ??
    after.cart.find((item) => item.pro_code === mutation.proCode)?.pro_name ??
    null;
  if (mutation.kind === 'REMOVE_PRODUCT') {
    const lines =
      before.cart
        .find((item) => item.pro_code === mutation.proCode)
        ?.shopping_cart.filter((line) => line.editable) ?? [];
    const units = [...new Set(lines.map((line) => line.spc_unit))];
    // Several units of one product cannot be expressed as a single from-quantity.
    return {
      proCode: mutation.proCode,
      proName,
      unit: units.length === 1 ? units[0] : null,
      fromQuantity:
        units.length === 1
          ? editableQuantity(before, mutation.proCode, units[0])
          : null,
      toQuantity: 0,
    };
  }
  return {
    proCode: mutation.proCode,
    proName,
    unit: mutation.unit,
    fromQuantity: editableQuantity(before, mutation.proCode, mutation.unit),
    toQuantity: editableQuantity(after, mutation.proCode, mutation.unit),
  };
}
