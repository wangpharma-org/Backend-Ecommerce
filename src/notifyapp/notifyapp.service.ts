import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThanOrEqual, MoreThanOrEqual, Repository } from 'typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { RefreshTokenEntity } from 'src/auth/refresh-token.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { Kafka, Producer } from 'kafkajs';
type NotificationTokenEventType = 'upsert' | 'remove';

@Injectable()
export class NotifyRtService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotifyRtService.name);
  private producer: Producer;

  constructor(
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepository: Repository<ShoppingOrderEntity>,
    @InjectRepository(NotificationTokenEntity)
    private readonly notificationTokenRepository: Repository<NotificationTokenEntity>,
    @InjectRepository(RefreshTokenEntity)
    private readonly refreshTokenRepository: Repository<RefreshTokenEntity>,
    private readonly jwtService: JwtService,
  ) {
    const kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'notifyapp',
      brokers: [process.env.KAFKA_BROKERS || 'localhost:9092'],
    });

    this.producer = kafka.producer();
  }

  async onModuleInit() {
    await this.producer.connect();
  }

  async onModuleDestroy() {
    await this.producer.disconnect();
  }

  @Cron('30 1 * * *', { timeZone: 'Asia/Bangkok' })
  async removeExpiredNotificationTokens(): Promise<void> {
    const runStartedAt = new Date();

    try {
      const notificationTokens = await this.notificationTokenRepository.find({
        where: { is_active: true },
        select: {
          id: true,
          mem_code: true,
          token: true,
          updated_at: true,
        },
      });

      if (notificationTokens.length === 0) {
        return;
      }

      const memberCodes = [
        ...new Set(notificationTokens.map(({ mem_code }) => mem_code)),
      ];
      const refreshTokens = await this.refreshTokenRepository.find({
        where: { mem_code: In(memberCodes) },
        select: {
          id: true,
          mem_code: true,
          refresh_token: true,
        },
      });
      const refreshTokensByMember =
        this.groupRefreshTokensByMember(refreshTokens);

      let deactivatedCount = 0;
      let skippedWithValidRefreshCount = 0;
      let skippedWithoutRefreshCount = 0;
      let failedCount = 0;

      for (const notificationToken of notificationTokens) {
        const memberRefreshTokens = refreshTokensByMember.get(
          notificationToken.mem_code,
        );

        if (!memberRefreshTokens || memberRefreshTokens.length === 0) {
          skippedWithoutRefreshCount += 1;
          continue;
        }

        if (
          await this.hasValidRefreshToken(
            notificationToken.mem_code,
            memberRefreshTokens,
          )
        ) {
          skippedWithValidRefreshCount += 1;
          continue;
        }

        const claimedToken = await this.notificationTokenRepository.update(
          {
            id: notificationToken.id,
            token: notificationToken.token,
            is_active: true,
            updated_at: LessThanOrEqual(runStartedAt),
          },
          {
            is_active: false,
            updated_at: new Date(),
          },
        );

        if (!claimedToken.affected) {
          continue;
        }

        try {
          await this.sendTokenToKafka(
            notificationToken.mem_code,
            notificationToken.token,
            'remove',
          );
          deactivatedCount += 1;
        } catch (error: unknown) {
          failedCount += 1;
          await this.notificationTokenRepository.update(
            {
              id: notificationToken.id,
              token: notificationToken.token,
              is_active: false,
            },
            {
              is_active: true,
              updated_at: new Date(),
            },
          );
          this.logger.error(
            `Failed to publish expired notification-token removal for member ${notificationToken.mem_code}`,
            error instanceof Error ? error.stack : String(error),
          );
        }
      }

      this.logger.log(
        `Expired notification-token cleanup completed: deactivated=${deactivatedCount}, valid_refresh=${skippedWithValidRefreshCount}, no_refresh_record=${skippedWithoutRefreshCount}, failed=${failedCount}`,
      );
    } catch (error: unknown) {
      this.logger.error(
        'Expired notification-token cleanup failed',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private groupRefreshTokensByMember(
    refreshTokens: RefreshTokenEntity[],
  ): Map<string, RefreshTokenEntity[]> {
    const refreshTokensByMember = new Map<string, RefreshTokenEntity[]>();

    for (const refreshToken of refreshTokens) {
      const memberRefreshTokens = refreshTokensByMember.get(
        refreshToken.mem_code,
      );
      if (memberRefreshTokens) {
        memberRefreshTokens.push(refreshToken);
      } else {
        refreshTokensByMember.set(refreshToken.mem_code, [refreshToken]);
      }
    }

    return refreshTokensByMember;
  }

  private async hasValidRefreshToken(
    memCode: string,
    refreshTokens: RefreshTokenEntity[],
  ): Promise<boolean> {
    for (const refreshToken of refreshTokens) {
      try {
        const payload = await this.jwtService.verifyAsync<{ mem_code: string }>(
          refreshToken.refresh_token,
          { secret: process.env.ACCESS_TOKEN_SECRET },
        );
        if (payload.mem_code === memCode) {
          return true;
        }
      } catch {
        // Invalid or expired refresh tokens are eligible for cleanup.
      }
    }

    return false;
  }

  async getRTOrdersInTheLast3Days(
    mem_code: string,
  ): Promise<ShoppingOrderEntity[]> {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    return this.shoppingOrderRepository.find({
      where: {
        is_rt: true,
        rt_date: MoreThanOrEqual(threeDaysAgo),
        orderHeader: {
          member: {
            mem_code: mem_code,
          },
        },
      },
      select: {
        spo_id: true,
        spo_qty: true,
        spo_unit: true,
        spo_price_unit: true,
        pro_code: true,
        orderHeader: {
          soh_running: true,
        },
        product: {
          pro_name: true,
          pro_imgmain: true,
        },
      },
      relations: ['orderHeader', 'product'],
    });
  }

  async updateRTStatus(data: {
    soh_running: string;
    pro_code: string;
  }): Promise<void> {
    const order = await this.shoppingOrderRepository.findOne({
      where: {
        orderHeader: {
          soh_running: data.soh_running,
        },
        pro_code: data.pro_code,
      },
      relations: ['orderHeader'],
    });
    if (!order) {
      return;
    }
    await this.shoppingOrderRepository.update(
      { spo_id: order.spo_id },
      { is_rt: true, rt_date: new Date() },
    );
  }

  async addTokenForNotification(data: {
    mem_code: string;
    token: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedToken = data.token?.trim();
      if (!normalizedToken) {
        return {
          success: false,
          message: 'Token is required',
        };
      }
      // ตรวจสอบว่ามี token เดิมอยู่แล้วหรือไม่
      const existingToken = await this.notificationTokenRepository.findOne({
        where: { mem_code: data.mem_code },
      });

      if (existingToken) {
        // อัพเดท token ถ้าเปลี่ยนแปลง
        if (existingToken.token !== normalizedToken) {
          await this.notificationTokenRepository.update(
            { id: existingToken.id },
            {
              token: normalizedToken,
              is_active: true,
              updated_at: new Date(),
            },
          );
          await this.sendTokenToKafka(data.mem_code, normalizedToken, 'upsert');
          return {
            success: true,
            message: 'Notification token updated successfully',
          };
        } else {
          // token เดิม เปิดใช้งานเฉยๆ
          await this.notificationTokenRepository.update(
            { id: existingToken.id },
            {
              is_active: true,
              updated_at: new Date(),
            },
          );
          await this.sendTokenToKafka(data.mem_code, normalizedToken, 'upsert');
          return {
            success: true,
            message: 'Notification token reactivated successfully',
          };
        }
      } else {
        // สร้างใหม่
        const newToken = this.notificationTokenRepository.create({
          mem_code: data.mem_code,
          token: normalizedToken,
          token_type: 'fcm',
          is_active: true,
        });

        await this.notificationTokenRepository.save(newToken);
        await this.sendTokenToKafka(data.mem_code, normalizedToken, 'upsert');
        return {
          success: true,
          message: 'Notification token added successfully',
        };
      }
    } catch (error) {
      this.logger.error('Error in addTokenForNotification:', error);
      return {
        success: false,
        message: 'Failed to add notification token',
      };
    }
  }

  async removeTokenForNotification(data: {
    mem_code: string;
    token: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const normalizedToken = data.token?.trim();
      if (!normalizedToken) {
        return {
          success: false,
          message: 'Token is required',
        };
      }

      const existingToken = await this.notificationTokenRepository.findOne({
        where: { mem_code: data.mem_code },
      });

      if (!existingToken) {
        await this.sendTokenToKafka(data.mem_code, normalizedToken, 'remove');
        return {
          success: true,
          message: 'Notification token already removed',
        };
      }

      if (existingToken.token !== normalizedToken) {
        await this.sendTokenToKafka(data.mem_code, normalizedToken, 'remove');
        return {
          success: true,
          message: 'Token mismatch, remove event published for provided token',
        };
      }

      await this.notificationTokenRepository.update(
        { id: existingToken.id },
        {
          is_active: false,
          updated_at: new Date(),
        },
      );

      await this.sendTokenToKafka(data.mem_code, normalizedToken, 'remove');

      return {
        success: true,
        message: 'Notification token removed successfully',
      };
    } catch (error) {
      this.logger.error('Error in removeTokenForNotification:', error);
      return {
        success: false,
        message: 'Failed to remove notification token',
      };
    }
  }

  async sendTokenToKafka(
    mem_code: string,
    token: string,
    event_type: NotificationTokenEventType = 'upsert',
  ): Promise<void> {
    const payload = {
      event_type,
      mem_code,
      token,
      occurred_at: new Date().toISOString(),
    };
    await this.producer.send({
      topic: process.env.KAFKA_TOPIC || 'noti_token',
      messages: [{ value: JSON.stringify(payload) }],
    });
  }
}
