import { BadGatewayException, BadRequestException } from '@nestjs/common';
import {
  parseCartActivityPage,
  toActivityQueryString,
} from './cart-activity.types';

const row = {
  id: '15',
  customerCode: 'M001',
  salespersonCode: 'EMP001',
  actorType: 'SALESPERSON',
  actorCode: 'EMP001',
  actorName: 'Somchai',
  action: 'CART_QUANTITY_CHANGED',
  consentId: 'c-1',
  sessionId: 's-1',
  details: {
    change: {
      proCode: 'P001',
      proName: 'Paracetamol',
      unit: 'BOX',
      fromQuantity: 2,
      toQuantity: 5,
    },
  },
  createdAt: '2026-10-20T03:00:00.000Z',
};

describe('cart activity', () => {
  it('passes through only the fields a customer needs', () => {
    expect(parseCartActivityPage({ items: [row], latestId: '15' })).toEqual({
      items: [
        {
          id: '15',
          action: 'CART_QUANTITY_CHANGED',
          actorType: 'SALESPERSON',
          actorName: 'Somchai',
          salespersonCode: 'EMP001',
          sessionId: 's-1',
          change: row.details.change,
          createdAt: row.createdAt,
        },
      ],
      latestId: '15',
    });
  });

  it('keeps rows without a product change', () => {
    const page = parseCartActivityPage({
      items: [{ ...row, action: 'SESSION_STOPPED', details: null }],
      latestId: '15',
    });
    expect(page.items[0].change).toBeNull();
  });

  it('rejects an unknown action or malformed change from Sale', () => {
    expect(() =>
      parseCartActivityPage({
        items: [{ ...row, action: 'DROP_TABLE' }],
        latestId: null,
      }),
    ).toThrow(BadGatewayException);
    expect(() =>
      parseCartActivityPage({
        items: [
          {
            ...row,
            details: { change: { ...row.details.change, toQuantity: '5' } },
          },
        ],
        latestId: null,
      }),
    ).toThrow(BadGatewayException);
    expect(() => parseCartActivityPage([])).toThrow(BadGatewayException);
  });

  it('forwards only positive integer cursors', () => {
    expect(toActivityQueryString({})).toBe('');
    expect(toActivityQueryString({ afterId: '15', limit: '20' })).toBe(
      '?afterId=15&limit=20',
    );
    for (const bad of ['0', 'abc', '1&x=1', '-3']) {
      expect(() => toActivityQueryString({ afterId: bad })).toThrow(
        BadRequestException,
      );
    }
    expect(() =>
      toActivityQueryString({ afterId: ['1', '2'] as unknown as string }),
    ).toThrow(BadRequestException);
  });
});
