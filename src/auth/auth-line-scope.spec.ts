import { of } from 'rxjs';
import { AuthService } from './auth.service';

type Signed = {
  payload: Record<string, unknown>;
  options?: { secret?: string };
};

function build(refreshPayload: Record<string, unknown> = {}) {
  const signed: Signed[] = [];
  const jwtService = {
    signAsync: jest.fn(
      (payload: Record<string, unknown>, options?: { secret?: string }) => {
        signed.push({ payload, options });
        return Promise.resolve(`token-${signed.length}`);
      },
    ),
    verifyAsync: jest.fn().mockResolvedValue(refreshPayload),
  };
  const user = {
    mem_username: 'shop',
    mem_nameSite: 'E2E ร้านผู้ดูแล',
    mem_code: '99001',
    permision_admin: true,
    role: 'Admin',
    admin_features: ['everything'],
  };
  const service = new AuthService(
    {} as never,
    jwtService as never,
    { findOne: jest.fn().mockResolvedValue(user) } as never,
    {
      post: jest.fn().mockReturnValue(of({ data: { mem_code: '99001' } })),
    } as never,
    {
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue({ refresh_token: 'old' }),
      delete: jest.fn().mockResolvedValue(undefined),
    } as never,
    {} as never,
    {} as never,
  );
  return { service, signed };
}

describe('AuthService — ขอบเขตของ token จากลิงก์ LINE', () => {
  const before = process.env.LINE_LINK_LOGIN_SCOPE;
  afterEach(() => {
    if (before === undefined) delete process.env.LINE_LINK_LOGIN_SCOPE;
    else process.env.LINE_LINK_LOGIN_SCOPE = before;
  });

  it('line-login-by-id: token และ refresh token มีขอบเขต review และไม่มีสิทธิ์ผู้ดูแล', async () => {
    delete process.env.LINE_LINK_LOGIN_SCOPE;
    const { service, signed } = build();
    await service.signinWithLineUserId('lt1.ticket');
    const [access, refresh] = signed;
    expect(access.payload).toMatchObject({
      mem_code: '99001',
      scope: 'review',
      permission: false,
      admin_features: null,
    });
    expect(refresh.payload).toMatchObject({
      mem_code: '99001',
      scope: 'review',
    });
  });

  it('LINE_LINK_LOGIN_SCOPE=full: พฤติกรรมเดิม', async () => {
    process.env.LINE_LINK_LOGIN_SCOPE = 'full';
    const { service, signed } = build();
    await service.signinWithLineUserId('lt1.ticket');
    expect(signed[0].payload).toMatchObject({ permission: true });
    expect(signed[0].payload).not.toHaveProperty('scope');
    expect(signed[1].payload).not.toHaveProperty('scope');
  });

  it('ต่ออายุ token ขอบเขต review: ได้ขอบเขตเดิม ไม่ได้ token เต็ม', async () => {
    const { service, signed } = build({ mem_code: '99001', scope: 'review' });
    await service.refreshToken('old', 'web');
    expect(signed[0].payload).toMatchObject({
      scope: 'review',
      permission: false,
      admin_features: null,
    });
    expect(signed[1].payload).toMatchObject({ scope: 'review' });
  });

  it('ต่ออายุ token ปกติ: ไม่ถูกจำกัด', async () => {
    const { service, signed } = build({ mem_code: '99001' });
    await service.refreshToken('old', 'web');
    expect(signed[0].payload).toMatchObject({ permission: true });
    expect(signed[0].payload).not.toHaveProperty('scope');
    expect(signed[1].payload).not.toHaveProperty('scope');
  });
});
