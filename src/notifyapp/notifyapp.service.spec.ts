import { JwtService } from '@nestjs/jwt';
import { UpdateResult } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { RefreshTokenEntity } from 'src/auth/refresh-token.entity';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { NotifyRtService } from './notifyapp.service';

describe('NotifyRtService notification lease', () => {
  const shoppingOrderRepository = {};
  const notificationTokenRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };
  const refreshTokenRepository = {
    findOne: jest.fn(),
  };
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  let service: NotifyRtService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        NotifyRtService,
        {
          provide: getRepositoryToken(ShoppingOrderEntity),
          useValue: shoppingOrderRepository,
        },
        {
          provide: getRepositoryToken(NotificationTokenEntity),
          useValue: notificationTokenRepository,
        },
        {
          provide: getRepositoryToken(RefreshTokenEntity),
          useValue: refreshTokenRepository,
        },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();
    service = module.get(NotifyRtService);
    jest.spyOn(service, 'sendTokenToKafka').mockResolvedValue();
    notificationTokenRepository.findOne.mockResolvedValue(null);
  });

  it('publishes the exact verified refresh-token expiry', async () => {
    const expirySeconds = Math.floor(Date.now() / 1000) + 3600;
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 1,
      mem_code: 'MEM001',
      refresh_token: 'refresh-1',
    });
    jwtService.verifyAsync.mockResolvedValue({
      mem_code: 'MEM001',
      exp: expirySeconds,
    });

    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: 'refresh-1',
    });

    expect(result.success).toBe(true);
    expect(service.sendTokenToKafka).toHaveBeenCalledWith(
      'MEM001',
      'fcm-1',
      'upsert',
      new Date(expirySeconds * 1000).toISOString(),
    );
  });

  it('rejects a refresh token without an exact member/token DB row', async () => {
    refreshTokenRepository.findOne.mockResolvedValue(null);

    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: 'other-account-refresh',
    });

    expect(result.success).toBe(false);
    expect(notificationTokenRepository.save).not.toHaveBeenCalled();
    expect(service.sendTokenToKafka).not.toHaveBeenCalled();
  });

  it('rejects a token whose verified member differs from the request', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 1,
      mem_code: 'MEM001',
      refresh_token: 'refresh-1',
    });
    jwtService.verifyAsync.mockResolvedValue({
      mem_code: 'MEM002',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: 'refresh-1',
    });

    expect(result.success).toBe(false);
    expect(service.sendTokenToKafka).not.toHaveBeenCalled();
  });

  it('rejects an expired refresh-token lease', async () => {
    refreshTokenRepository.findOne.mockResolvedValue({
      id: 1,
      mem_code: 'MEM001',
      refresh_token: 'expired-refresh',
    });
    jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: 'expired-refresh',
    });

    expect(result.success).toBe(false);
    expect(service.sendTokenToKafka).not.toHaveBeenCalled();
  });

  it('rejects an explicitly empty refresh token instead of granting a legacy lease', async () => {
    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: '',
    });

    expect(result.success).toBe(false);
    expect(service.sendTokenToKafka).not.toHaveBeenCalled();
  });

  it('rejects an explicit null refresh token instead of granting a legacy lease', async () => {
    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
      refresh_token: null,
    });

    expect(result.success).toBe(false);
    expect(service.sendTokenToKafka).not.toHaveBeenCalled();
  });

  it('keeps legacy registrations compatible without an expiry lease', async () => {
    const result = await service.addTokenForNotification({
      mem_code: 'MEM001',
      token: 'fcm-1',
    });

    expect(result.success).toBe(true);
    expect(service.sendTokenToKafka).toHaveBeenCalledWith(
      'MEM001',
      'fcm-1',
      'upsert',
      undefined,
    );
  });

  it('keys and serializes the expiry lease on the Kafka upsert event', async () => {
    (service.sendTokenToKafka as jest.Mock).mockRestore();
    const producerSend = jest.fn().mockResolvedValue([]);
    Reflect.set(service, 'producer', { send: producerSend });

    await service.sendTokenToKafka(
      'MEM001',
      'fcm-1',
      'upsert',
      '2026-09-19T00:00:00.000Z',
    );

    const request = producerSend.mock.calls[0][0];
    expect(request.topic).toBe('noti_token');
    expect(request.messages[0].key).toBe('MEM001:fcm-1');
    expect(JSON.parse(request.messages[0].value)).toEqual(
      expect.objectContaining({
        event_type: 'upsert',
        mem_code: 'MEM001',
        token: 'fcm-1',
        expires_at: '2026-09-19T00:00:00.000Z',
      }),
    );
  });
});
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
