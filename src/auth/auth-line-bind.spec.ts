import {
  BadRequestException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AuthService } from './auth.service';

const TICKET = 'lt1.payload.signature';

function build(payload: Record<string, unknown> | Error) {
  const jwtService = {
    verifyAsync: jest
      .fn()
      .mockImplementation(() =>
        payload instanceof Error
          ? Promise.reject(payload)
          : Promise.resolve(payload),
      ),
  };
  const httpService = { post: jest.fn().mockReturnValue(of({ data: {} })) };
  const service = new AuthService(
    {} as never,
    jwtService as never,
    {} as never,
    httpService as never,
    {} as never,
    {} as never,
  );
  return { service, jwtService, httpService };
}

describe('AuthService.bindLineAccount', () => {
  const env = { ...process.env };
  beforeEach(() => {
    process.env.NOTIFICATION_SERVICE_URL = 'http://notify.test';
    process.env.NOTIFICATION_INTERNAL_TOKEN = 'internal-token';
  });
  afterEach(() => {
    process.env = { ...env };
  });

  it('ใช้รหัสร้านจาก token ที่ตรวจแล้ว และแนบ internal token ไป notification-service', async () => {
    const { service, httpService } = build({ mem_code: ' 99001 ' });
    await expect(
      service.bindLineAccount('Bearer session-jwt', TICKET),
    ).resolves.toEqual({ linked: true });
    expect(httpService.post).toHaveBeenCalledWith(
      'http://notify.test/api/notifications/line/bind',
      { memCode: '99001', lineUserId: TICKET },
      expect.objectContaining({
        headers: { 'x-internal-token': 'internal-token' },
      }),
    );
  });

  it('ไม่มี token / token ไม่ผ่าน / token ไม่มีรหัสร้าน = 401 และไม่เรียก notification-service', async () => {
    const noHeader = build({ mem_code: '99001' });
    for (const header of [undefined, '', 'Basic abc', 'Bearer']) {
      await expect(
        noHeader.service.bindLineAccount(header, TICKET),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    }
    expect(noHeader.httpService.post).not.toHaveBeenCalled();

    const badToken = build(new Error('jwt expired'));
    await expect(
      badToken.service.bindLineAccount('Bearer expired', TICKET),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(badToken.httpService.post).not.toHaveBeenCalled();

    const noShop = build({ username: 'admin' });
    await expect(
      noShop.service.bindLineAccount('Bearer session-jwt', TICKET),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(noShop.httpService.post).not.toHaveBeenCalled();
  });

  it('ไม่มีค่า token จากลิงก์ = 400', async () => {
    const { service, httpService } = build({ mem_code: '99001' });
    for (const value of [undefined, '', '   ', 42, 'x'.repeat(601)]) {
      await expect(
        service.bindLineAccount('Bearer session-jwt', value),
      ).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('notification-service ปฏิเสธตั๋ว = 400 พร้อมข้อความเดิม', async () => {
    const { service, httpService } = build({ mem_code: '99001' });
    httpService.post.mockReturnValue(
      throwError(() => ({
        response: {
          status: 401,
          data: { message: 'ลิงก์ยืนยันตัวตนหมดอายุแล้ว' },
        },
      })),
    );
    await expect(
      service.bindLineAccount('Bearer session-jwt', TICKET),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      message: 'ลิงก์ยืนยันตัวตนหมดอายุแล้ว',
    });
  });

  it('notification-service ล่ม = 503', async () => {
    const { service, httpService } = build({ mem_code: '99001' });
    httpService.post.mockReturnValue(
      throwError(() => new Error('connect ECONNREFUSED')),
    );
    await expect(
      service.bindLineAccount('Bearer session-jwt', TICKET),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
