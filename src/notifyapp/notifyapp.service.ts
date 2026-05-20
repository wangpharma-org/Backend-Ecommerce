import {
  BadGatewayException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';
import axios from 'axios';
import {
  AdminNotificationChannel,
  AdminNotificationFilterDto,
  AdminNotificationTargetMode,
  SendAdminNotificationDto,
} from './dto/send-admin-notification.dto';
import { UserEntity } from '../users/users.entity';
type NotificationTokenEventType = 'upsert' | 'remove';

const NOTIFICATION_BATCH_SIZE = 500;

export interface SmsCreditBalanceResponse {
  standard: number;
  corporate: number;
  total: number;
}

@Injectable()
export class NotifyRtService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;
  private readonly notificationServiceUrl =
    process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005';
  private readonly notificationInternalToken =
    process.env.NOTIFICATION_INTERNAL_TOKEN?.trim();

  constructor(
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepository: Repository<ShoppingOrderEntity>,
    @InjectRepository(NotificationTokenEntity)
    private readonly notificationTokenRepository: Repository<NotificationTokenEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
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
      console.error('Error in addTokenForNotification:', error);
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
      console.error('Error in removeTokenForNotification:', error);
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
  ) {
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
    console.log(
      `Sent ${event_type} token event for mem_code ${mem_code} token ${token} to Kafka topic ${process.env.KAFKA_TOPIC || 'noti_token'} successfully`,
    );
  }

  async sendAdminNotification(payload: SendAdminNotificationDto) {
    const targetMode = this.resolveTargetMode(payload);
    const targets = [payload.memCode, payload.phoneNumber].filter(Boolean);

    if (
      targetMode !== AdminNotificationTargetMode.SINGLE &&
      targets.length > 0
    ) {
      throw new BadRequestException(
        'memCode or phoneNumber can be used only with single target mode',
      );
    }

    const channels =
      payload.channels && payload.channels.length > 0
        ? payload.channels
        : this.getDefaultChannels(payload);

    const isFcmOnlyChannel =
      channels.length === 1 && channels[0] === AdminNotificationChannel.FCM;

    if (payload.data && !isFcmOnlyChannel) {
      throw new BadRequestException(
        'data is supported only when the notification channel is FCM only',
      );
    }

    const recipientMemCodes = await this.resolveRecipientMemCodes(
      payload,
      targetMode,
    );

    if (recipientMemCodes.length === 0) {
      throw new BadRequestException('No recipients found for this notification');
    }

    const baseNotificationPayload = {
      type: payload.type?.trim() || 'GENERAL',
      title: payload.title.trim(),
      message: payload.message.trim(),
      channels,
      ...(payload.data ? { data: payload.data } : {}),
    };

    const topic =
      process.env.KAFKA_NOTIFICATION_CREATED_TOPIC || 'notification.created';

    for (
      let index = 0;
      index < recipientMemCodes.length;
      index += NOTIFICATION_BATCH_SIZE
    ) {
      const batch = recipientMemCodes.slice(index, index + NOTIFICATION_BATCH_SIZE);
      await this.producer.send({
        topic,
        messages: batch.map((memCode) => ({
          value: JSON.stringify({
            memCode,
            ...baseNotificationPayload,
          }),
        })),
      });
    }

    return {
      success: true,
      topic,
      targetMode,
      recipientCount: recipientMemCodes.length,
      message: `Published ${recipientMemCodes.length} notification event(s) successfully`,
    };
  }

  async getNotificationProvinces() {
    const provinces = await this.userRepository
      .createQueryBuilder('user')
      .select('DISTINCT user.mem_province', 'province')
      .where('user.mem_province IS NOT NULL')
      .andWhere("TRIM(user.mem_province) <> ''")
      .orderBy('user.mem_province', 'ASC')
      .getRawMany<{ province: string }>();

    return {
      provinces: provinces
        .map((item) => item.province?.trim())
        .filter((province): province is string => Boolean(province)),
    };
  }

  async getSmsCreditBalance(): Promise<SmsCreditBalanceResponse> {
    try {
      const response = await axios.get<SmsCreditBalanceResponse>(
        `${this.notificationServiceUrl}/api/notifications/admin/sms-credit`,
        {
          headers: this.notificationInternalToken
            ? {
                'x-internal-token': this.notificationInternalToken,
              }
            : undefined,
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.message ||
          'Unable to fetch SMS credit balance';
        throw new BadGatewayException(
          Array.isArray(message) ? message.join(', ') : String(message),
        );
      }

      throw new BadGatewayException('Unable to fetch SMS credit balance');
    }
  }

  private getDefaultChannels(
    payload: SendAdminNotificationDto,
  ): AdminNotificationChannel[] {
    if (payload.phoneNumber) {
      return [AdminNotificationChannel.SMS];
    }

    return [AdminNotificationChannel.FCM];
  }

  private resolveTargetMode(
    payload: SendAdminNotificationDto,
  ): AdminNotificationTargetMode {
    if (payload.targetMode) {
      return payload.targetMode;
    }

    if (payload.broadcast === true) {
      return AdminNotificationTargetMode.BROADCAST;
    }

    if (payload.memCode || payload.phoneNumber) {
      return AdminNotificationTargetMode.SINGLE;
    }

    return AdminNotificationTargetMode.SINGLE;
  }

  private async resolveRecipientMemCodes(
    payload: SendAdminNotificationDto,
    targetMode: AdminNotificationTargetMode,
  ): Promise<string[]> {
    if (targetMode === AdminNotificationTargetMode.SINGLE) {
      if (payload.memCode?.trim()) {
        return [payload.memCode.trim()];
      }

      if (payload.phoneNumber?.trim()) {
        throw new BadRequestException(
          'phoneNumber direct target is not supported for admin notifications, use memCode instead',
        );
      }

      throw new BadRequestException(
        'memCode is required when target mode is single',
      );
    }

    if (targetMode === AdminNotificationTargetMode.BROADCAST) {
      return this.findMemberCodes();
    }

    if (targetMode === AdminNotificationTargetMode.SEGMENT) {
      this.validateSegmentFilter(payload.filter);
      return this.findMemberCodes(payload.filter);
    }

    throw new BadRequestException('Unsupported target mode');
  }

  private validateSegmentFilter(filter?: AdminNotificationFilterDto) {
    const hasProvinceFilter = (filter?.provinces?.length ?? 0) > 0;
    const hasPriceGroupFilter = (filter?.priceGroups?.length ?? 0) > 0;

    if (!hasProvinceFilter && !hasPriceGroupFilter) {
      throw new BadRequestException(
        'At least one segment filter is required for segment mode',
      );
    }
  }

  private async findMemberCodes(
    filter?: AdminNotificationFilterDto,
  ): Promise<string[]> {
    const queryBuilder = this.userRepository
      .createQueryBuilder('user')
      .select('user.mem_code', 'mem_code')
      .where('user.mem_code IS NOT NULL')
      .andWhere("TRIM(user.mem_code) <> ''");

    if (filter?.provinces?.length) {
      queryBuilder.andWhere('user.mem_province IN (:...provinces)', {
        provinces: filter.provinces,
      });
    }

    if (filter?.priceGroups?.length) {
      queryBuilder.andWhere('user.mem_price IN (:...priceGroups)', {
        priceGroups: filter.priceGroups,
      });
    }

    const users = await queryBuilder.getRawMany<{ mem_code: string }>();

    return Array.from(
      new Set(
        users
          .map((user) => user.mem_code?.trim())
          .filter((memCode): memCode is string => Boolean(memCode)),
      ),
    );
  }
}
