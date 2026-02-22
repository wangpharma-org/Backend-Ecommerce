import { Injectable } from '@nestjs/common';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Kafka, Producer } from 'kafkajs';

@Injectable()
export class NotifyRtService implements OnModuleInit, OnModuleDestroy {
  private producer: Producer;

  constructor(
    @InjectRepository(ShoppingOrderEntity)
    private readonly shoppingOrderRepository: Repository<ShoppingOrderEntity>,
    @InjectRepository(NotificationTokenEntity)
    private readonly notificationTokenRepository: Repository<NotificationTokenEntity>,
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
      // ตรวจสอบว่ามี token เดิมอยู่แล้วหรือไม่
      const existingToken = await this.notificationTokenRepository.findOne({
        where: { mem_code: data.mem_code },
      });

      if (existingToken) {
        // อัพเดท token ถ้าเปลี่ยนแปลง
        if (existingToken.token !== data.token) {
          await this.notificationTokenRepository.update(
            { id: existingToken.id },
            {
              token: data.token,
              is_active: true,
              updated_at: new Date(),
            },
          );
          await this.sendTokenToKafka(data.mem_code, data.token);
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
          await this.sendTokenToKafka(data.mem_code, data.token);
          return {
            success: true,
            message: 'Notification token reactivated successfully',
          };
        }
      } else {
        // สร้างใหม่
        const newToken = this.notificationTokenRepository.create({
          mem_code: data.mem_code,
          token: data.token,
          token_type: 'fcm',
          is_active: true,
        });

        await this.notificationTokenRepository.save(newToken);
        await this.sendTokenToKafka(data.mem_code, data.token);
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

  async sendTokenToKafka(mem_code: string, token: string) {
    const payload = { mem_code, token };
    await this.producer.send({
      topic: process.env.KAFKA_TOPIC || 'noti_token',
      messages: [{ value: JSON.stringify(payload) }],
    });
    console.log(
      `Sent token for mem_code ${mem_code} token ${token} to Kafka topic ${process.env.KAFKA_TOPIC || 'noti_token'} successfully`,
    );
  }
}
