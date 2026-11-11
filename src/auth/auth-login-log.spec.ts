import { Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('AuthService.signin logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('logs the verified member after a successful login without logging credentials', async () => {
    jest.mocked(bcrypt.compare).mockResolvedValue(true as never);
    const logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const service = new AuthService(
      {
        findOne: jest.fn().mockResolvedValue({
          mem_username: 'store-0582',
          mem_code: '0582',
          mem_password: 'hashed-password',
          mem_nameSite: 'ร้านตัวอย่าง',
          mem_price: 'C',
          mem_address: '',
          mem_village: '',
          mem_alley: '',
          mem_tumbon: '',
          mem_amphur: '',
          mem_province: '',
          mem_post: '',
          mem_phone: '',
          mem_route: '',
          permision_admin: false,
          role: 'user',
          admin_features: null,
        }),
      } as never,
      {
        signAsync: jest
          .fn()
          .mockResolvedValueOnce('access-token')
          .mockResolvedValueOnce('refresh-token'),
      } as never,
      {} as never,
      {} as never,
      { save: jest.fn().mockResolvedValue(undefined) } as never,
      {} as never,
    );

    await service.signin({
      username: 'store-0582',
      password: 'must-not-appear-in-log',
    });

    expect(logger).toHaveBeenCalledWith({
      event: 'login_success',
      route: '/api/ecom/login',
      actor: { memCode: '0582', username: 'store-0582' },
      success: true,
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain(
      'must-not-appear-in-log',
    );
  });
});
