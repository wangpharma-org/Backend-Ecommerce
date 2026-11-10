import { ForbiddenException } from '@nestjs/common';
import { ownCartMemCode } from './cart-owner';

describe('ownCartMemCode (ECWC-750)', () => {
  it('returns the token shop when the request names the same shop', () => {
    expect(ownCartMemCode({ mem_code: 'S001' }, 'S001')).toBe('S001');
    expect(ownCartMemCode({ mem_code: 'S001' }, ' S001 ')).toBe('S001');
  });

  it('falls back to the token shop when the request names none', () => {
    expect(ownCartMemCode({ mem_code: 'S001' }, undefined)).toBe('S001');
    expect(ownCartMemCode({ mem_code: 'S001' }, '')).toBe('S001');
  });

  it.each([
    ['another shop', { mem_code: 'S001' }, 'S002'],
    [
      'a staff token naming a shop (no permission bypass)',
      { mem_code: 'E001', permission: true },
      'S002',
    ],
    ['a non-string code', { mem_code: 'S001' }, ['S001']],
    ['a token without mem_code', {}, 'S001'],
    ['no token', undefined, 'S001'],
  ])('rejects %s with 403', (_label, caller, claimed) => {
    expect(() => ownCartMemCode(caller as never, claimed)).toThrow(
      ForbiddenException,
    );
  });
});
