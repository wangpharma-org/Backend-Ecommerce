import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
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
