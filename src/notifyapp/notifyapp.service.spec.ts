import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UpdateResult } from 'typeorm';
import { RefreshTokenEntity } from 'src/auth/refresh-token.entity';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { NotifyRtService } from './notifyapp.service';

describe('NotifyRtService expired notification-token cleanup', () => {
  let service: NotifyRtService;
  let sendTokenToKafkaSpy: jest.SpiedFunction<
    NotifyRtService['sendTokenToKafka']
  >;
  const notificationTokenRepository = {
    find: jest.fn(),
    update: jest.fn(),
  };
  const refreshTokenRepository = {
    find: jest.fn(),
  };
  const jwtService = {
    verifyAsync: jest.fn(),
  };

  const createNotificationToken = (): NotificationTokenEntity => {
    const notificationToken = new NotificationTokenEntity();
    notificationToken.id = 1;
    notificationToken.mem_code = 'MEM001';
    notificationToken.token = 'fcm-token';
    notificationToken.is_active = true;
    notificationToken.updated_at = new Date('2026-08-01T00:00:00.000Z');
    return notificationToken;
  };

  const createRefreshToken = (token: string): RefreshTokenEntity => {
    const refreshToken = new RefreshTokenEntity();
    refreshToken.id = 1;
    refreshToken.mem_code = 'MEM001';
    refreshToken.refresh_token = token;
    return refreshToken;
  };

  const createUpdateResult = (affected: number): UpdateResult => {
    const result = new UpdateResult();
    result.raw = [];
    result.affected = affected;
    return result;
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotifyRtService,
        {
          provide: getRepositoryToken(ShoppingOrderEntity),
          useValue: {},
        },
        {
          provide: getRepositoryToken(NotificationTokenEntity),
          useValue: notificationTokenRepository,
        },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: refreshTokenRepository,
        },
        {
          provide: JwtService,
          useValue: jwtService,
        },
      ],
    }).compile();

    service = module.get<NotifyRtService>(NotifyRtService);
    sendTokenToKafkaSpy = jest
      .spyOn(service, 'sendTokenToKafka')
      .mockResolvedValue();
  });

  it('deactivates and publishes remove when all refresh tokens are expired', async () => {
    notificationTokenRepository.find.mockResolvedValue([
      createNotificationToken(),
    ]);
    refreshTokenRepository.find.mockResolvedValue([
      createRefreshToken('expired-refresh-token'),
    ]);
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    notificationTokenRepository.update.mockResolvedValue(createUpdateResult(1));

    await service.removeExpiredNotificationTokens();

    expect(notificationTokenRepository.update).toHaveBeenCalledTimes(1);
    expect(sendTokenToKafkaSpy).toHaveBeenCalledWith(
      'MEM001',
      'fcm-token',
      'remove',
    );
  });

  it('keeps notification active when one refresh token is still valid', async () => {
    notificationTokenRepository.find.mockResolvedValue([
      createNotificationToken(),
    ]);
    refreshTokenRepository.find.mockResolvedValue([
      createRefreshToken('expired-refresh-token'),
      createRefreshToken('valid-refresh-token'),
    ]);
    jwtService.verifyAsync
      .mockRejectedValueOnce(new Error('jwt expired'))
      .mockResolvedValueOnce({ mem_code: 'MEM001' });

    await service.removeExpiredNotificationTokens();

    expect(notificationTokenRepository.update).not.toHaveBeenCalled();
    expect(sendTokenToKafkaSpy).not.toHaveBeenCalled();
  });

  it('keeps notification active when no refresh-token record exists', async () => {
    notificationTokenRepository.find.mockResolvedValue([
      createNotificationToken(),
    ]);
    refreshTokenRepository.find.mockResolvedValue([]);

    await service.removeExpiredNotificationTokens();

    expect(notificationTokenRepository.update).not.toHaveBeenCalled();
    expect(sendTokenToKafkaSpy).not.toHaveBeenCalled();
  });

  it('reactivates the notification token when publishing removal fails', async () => {
    notificationTokenRepository.find.mockResolvedValue([
      createNotificationToken(),
    ]);
    refreshTokenRepository.find.mockResolvedValue([
      createRefreshToken('expired-refresh-token'),
    ]);
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    notificationTokenRepository.update.mockResolvedValue(createUpdateResult(1));
    sendTokenToKafkaSpy.mockRejectedValueOnce(new Error('kafka unavailable'));

    await service.removeExpiredNotificationTokens();

    expect(notificationTokenRepository.update).toHaveBeenCalledTimes(2);
  });

  it('does not publish when another process already claimed the token', async () => {
    notificationTokenRepository.find.mockResolvedValue([
      createNotificationToken(),
    ]);
    refreshTokenRepository.find.mockResolvedValue([
      createRefreshToken('expired-refresh-token'),
    ]);
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));
    notificationTokenRepository.update.mockResolvedValue(createUpdateResult(0));

    await service.removeExpiredNotificationTokens();

    expect(sendTokenToKafkaSpy).not.toHaveBeenCalled();
  });
});
