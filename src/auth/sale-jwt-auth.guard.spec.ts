import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { SaleJwtAuthGuard } from './sale-jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

describe('shared JWT boundaries', () => {
  const jwt = new JwtService({ secret: 'shared-test-secret' });
  const config = {
    get: (key: string) =>
      key === 'ACCESS_TOKEN_SECRET' ? 'shared-test-secret' : undefined,
  };
  let guard: SaleJwtAuthGuard;
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SaleJwtAuthGuard,
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    guard = module.get(SaleJwtAuthGuard);
  });
  const contextFor = (token: string) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization: `Bearer ${token}` } }),
      }),
    }) as ExecutionContext;

  it('accepts a Sale token only on the Sale cart guard', async () => {
    const saleToken = await jwt.signAsync({
      emp_code: 'EMP001',
      platform_id: 'sale',
    });
    await expect(guard.canActivate(contextFor(saleToken))).resolves.toBe(true);
    expect(() =>
      new JwtStrategy().validate({ emp_code: 'EMP001', platform_id: 'sale' }),
    ).toThrow(UnauthorizedException);
  });

  it('rejects a customer token on the Sale cart guard', async () => {
    const customerToken = await jwt.signAsync({ mem_code: 'M001' });
    await expect(
      guard.canActivate(contextFor(customerToken)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(new JwtStrategy().validate({ mem_code: 'M001' })).toEqual({
      mem_code: 'M001',
    });
  });
});
