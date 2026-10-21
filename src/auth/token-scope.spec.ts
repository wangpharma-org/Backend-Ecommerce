import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  PASSWORD_CHANGE_SCOPE,
  carriedScope,
  isAllowedForPasswordChangeScope,
  isAllowedForReviewScope,
  lineLinkLoginScope,
} from './token-scope';

describe('token scope — review', () => {
  it('เส้นทางที่หน้ารีวิวเรียกใช้ได้', () => {
    for (const url of [
      '/api/ecom/rating',
      '/api/ecom/rating/batch',
      '/api/ecom/rating/check/SH001',
      '/api/ecom/rating/config/select?type=x',
      '/api/ecom/rating/12/images',
      '/api/ecom/review-request/pending/99001',
      '/api/ecom/review-request/complete',
      '/api/ecom/session/create',
      '/api/ecom/session/validate/abc.def.ghi',
      '/api/ecom/session/logout',
    ]) {
      expect(isAllowedForReviewScope(url)).toBe(true);
    }
  });

  it('เส้นทางอื่นใช้ไม่ได้ รวมถึงของผู้ดูแลและ session อื่นของร้าน', () => {
    for (const url of [
      '/api/ecom/admin/rating',
      '/api/ecom/admin/rating/config/select',
      '/api/ecom/ratings-export',
      '/api/ecom/session/logout-all',
      '/api/ecom/session/user-sessions/99001',
      '/api/ecom/products/flashsale-procode',
      '/api/ecom/qc/add-token-for-notification',
      '/api/ecom/rating/../admin/rating',
      '',
      undefined,
    ]) {
      expect(isAllowedForReviewScope(url)).toBe(false);
    }
  });

  it('LINE_LINK_LOGIN_SCOPE: ค่าเริ่มต้นคือ review · full = token เต็มแบบเดิม', () => {
    const before = process.env.LINE_LINK_LOGIN_SCOPE;
    delete process.env.LINE_LINK_LOGIN_SCOPE;
    expect(lineLinkLoginScope()).toBe('review');
    process.env.LINE_LINK_LOGIN_SCOPE = ' FULL ';
    expect(lineLinkLoginScope()).toBeNull();
    process.env.LINE_LINK_LOGIN_SCOPE = 'anything-else';
    expect(lineLinkLoginScope()).toBe('review');
    if (before === undefined) delete process.env.LINE_LINK_LOGIN_SCOPE;
    else process.env.LINE_LINK_LOGIN_SCOPE = before;
  });
});

describe('JwtAuthGuard — token ขอบเขต review', () => {
  const context = (user: Record<string, unknown>, originalUrl: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, originalUrl, headers: {} }),
      }),
    }) as unknown as ExecutionContext;
  const guard = new JwtAuthGuard(
    { getFlag: jest.fn().mockResolvedValue(true) } as never,
    {} as never,
  );

  beforeEach(() => {
    // ข้ามการตรวจลายเซ็นของ passport — ทดสอบเฉพาะการตัดสินตามขอบเขตหลัง token ผ่านแล้ว
    jest
      .spyOn(
        Object.getPrototypeOf(JwtAuthGuard.prototype) as {
          canActivate: () => Promise<boolean>;
        },
        'canActivate',
      )
      .mockResolvedValue(true);
  });
  afterEach(() => jest.restoreAllMocks());

  it('token ขอบเขต review: เส้นทางรีวิวผ่าน เส้นทางอื่น 403', async () => {
    const user = { mem_code: '99001', scope: 'review' };
    await expect(
      guard.canActivate(context(user, '/api/ecom/rating/batch')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context(user, '/api/ecom/products/flashsale-procode')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(context(user, '/api/ecom/admin/rating')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ECWC-706 token ขอบเขต password_change: ตั้งรหัสใหม่ผ่าน เส้นทางอื่น 403', async () => {
    const user = { mem_code: '99001', scope: PASSWORD_CHANGE_SCOPE };
    await expect(
      guard.canActivate(context(user, '/api/ecom/password-reset/set-password')),
    ).resolves.toBe(true);
    await expect(
      guard.canActivate(context(user, '/api/ecom/search-products')),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      guard.canActivate(context(user, '/api/ecom/rating/batch')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('token ปกติ (ไม่มีขอบเขต) ไม่ถูกจำกัด', async () => {
    await expect(
      guard.canActivate(
        context({ mem_code: '99001' }, '/api/ecom/products/flashsale-procode'),
      ),
    ).resolves.toBe(true);
  });
});

describe('ECWC-706 ขอบเขต password_change', () => {
  it('ใช้ได้แค่ตั้งรหัสใหม่และ session', () => {
    expect(
      isAllowedForPasswordChangeScope('/api/ecom/password-reset/set-password'),
    ).toBe(true);
    expect(isAllowedForPasswordChangeScope('/api/ecom/session/create')).toBe(
      true,
    );
    expect(
      isAllowedForPasswordChangeScope('/api/ecom/session/validate/abc'),
    ).toBe(true);
    expect(isAllowedForPasswordChangeScope('/api/ecom/search-products')).toBe(
      false,
    );
    expect(
      isAllowedForPasswordChangeScope('/api/ecom/password/change-password'),
    ).toBe(false);
    expect(
      isAllowedForPasswordChangeScope(
        '/api/ecom/password-reset/set-password/../../shopping-cart',
      ),
    ).toBe(false);
  });

  it('refresh คงขอบเขตเดิม', () => {
    expect(carriedScope('password_change')).toBe(PASSWORD_CHANGE_SCOPE);
    expect(carriedScope('review')).toBe('review');
    expect(carriedScope('admin')).toBeNull();
    expect(carriedScope(undefined)).toBeNull();
  });
});
