import { BadRequestException } from '@nestjs/common';
import { parseSaleOrderRequestInput } from './sale-order-request.types';

describe('parseSaleOrderRequestInput', () => {
  const input = {
    expectedCartVersion: '42',
    addressId: 7,
    shippingOption: 'wang',
    paymentOption: 'wang-credit',
  };

  it('accepts existing checkout options with an owned address identifier', () => {
    expect(parseSaleOrderRequestInput(input)).toEqual(input);
  });

  it.each([
    { ...input, expectedCartVersion: '42abc' },
    { ...input, expectedCartVersion: '-1' },
    { ...input, addressId: 0 },
    { ...input, addressId: 1.5 },
    { ...input, shippingOption: 'courier' },
    { ...input, paymentOption: 'cash' },
    [],
    null,
  ])('rejects invalid checkout input %#', (candidate) => {
    expect(() => parseSaleOrderRequestInput(candidate)).toThrow(
      BadRequestException,
    );
  });
});
