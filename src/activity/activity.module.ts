import { Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ACTIVITY_KAFKA_CLIENT } from './activity.constants';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';

const logger = new Logger('ActivityModule');

@Module({
  imports: [ConfigModule, FeatureFlagsModule],
  controllers: [ActivityController],
  providers: [
    {
      provide: ACTIVITY_KAFKA_CLIENT,
      inject: [ConfigService],
      // ไม่มีค่า default เป็น broker จริง — รันในเครื่องโดยไม่ตั้ง env ต้องไม่ส่งอีเวนต์ทดสอบเข้า prod
      useFactory: (config: ConfigService) => {
        const brokers = (
          config.get<string>('KAFKA_ACTIVITY_BROKERS') ||
          config.get<string>('KAFKA_BROKERS_SECOND') ||
          ''
        )
          .split(',')
          .map((b) => b.trim())
          .filter(Boolean);
        if (!brokers.length) {
          logger.warn(
            'KAFKA_ACTIVITY_BROKERS / KAFKA_BROKERS_SECOND not set — activity events disabled',
          );
          return null;
        }
        logger.log(`Activity Kafka brokers: ${brokers.join(',')}`);
        return ClientProxyFactory.create({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId:
                config.get<string>('KAFKA_ACTIVITY_CLIENT_ID') ||
                'backend-ecommerce-activity',
              brokers,
              connectionTimeout: 5000,
              requestTimeout: 3000,
              retry: { retries: 2 },
            },
            producerOnlyMode: true,
          },
        });
      },
    },
    ActivityService,
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
