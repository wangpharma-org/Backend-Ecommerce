import { ForbiddenException } from '@nestjs/common';
import { assertOwnShop, sessionOwnerFilter } from './session-owner';

describe('session owner', () => {
  it('ร้านของตัวเองผ่าน ร้านอื่นถูกปฏิเสธ', () => {
    const shop = { mem_code: '99001', permission: false };
    expect(() => assertOwnShop(shop, '99001')).not.toThrow();
    for (const other of ['99777', '', '99001 ', '9900']) {
      expect(() => assertOwnShop(shop, other)).toThrow(ForbiddenException);
    }
  });

  it('ผู้ดูแลจัดการ session ของร้านอื่นได้', () => {
    const admin = { mem_code: 'ADMIN', permission: true };
    expect(() => assertOwnShop(admin, '99777')).not.toThrow();
    expect(sessionOwnerFilter(admin)).toBeUndefined();
    expect(() =>
      assertOwnShop({ mem_code: 'ADMIN', permission: 1 }, '99777'),
    ).not.toThrow();
  });

  it('permission ที่ไม่ใช่ true จริง ๆ ไม่นับเป็นผู้ดูแล', () => {
    for (const permission of ['true', '1', 2, {}, null, undefined]) {
      expect(() =>
        assertOwnShop({ mem_code: '99001', permission }, '99777'),
      ).toThrow(ForbiddenException);
    }
  });

  it('token ที่ไม่มีรหัสร้านถูกปฏิเสธ ไม่กลายเป็น "ไม่จำกัด"', () => {
    expect(() => assertOwnShop({}, '')).toThrow(ForbiddenException);
    expect(() => assertOwnShop(undefined, '99001')).toThrow(ForbiddenException);
    expect(() => sessionOwnerFilter({})).toThrow(ForbiddenException);
    expect(sessionOwnerFilter({ mem_code: '99001' })).toBe('99001');
  });
});
