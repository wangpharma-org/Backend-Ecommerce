import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';
import { CompanyDayAnalyticService } from './company-day-analytic.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    FeatureFlagsModule,
    ClientsModule.registerAsync([
      {
        name: COMPANY_DAY_ANALYTIC_KAFKA_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          try {
            const brokers = (
              configService.get<string>('KAFKA_COMPANY_DAY_BROKERS') ||
              configService.get<string>('KAFKA_BROKERS_SECOND') ||
              '104.248.146.202:9092'
            )
              .split(',')
              .map((broker) => broker.trim())
              .filter(Boolean);

            const groupId =
              configService.get<string>('KAFKA_COMPANY_DAY_GROUP_ID') ||
              configService.get<string>('KAFKA_GROUP_ID_SECOND') ||
              'consumer-analytic';

            const clientId =
              configService.get<string>('KAFKA_COMPANY_DAY_CLIENT_ID') ||
              'backend-ecommerce-company-day';

            console.log(`
              Analytics Kafka Config - Brokers: ${brokers.join(',')}, GroupId: ${groupId}`);
            return {
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId,
                  brokers,
                  connectionTimeout: 5000,
                  requestTimeout: 3000,
                  retry: {
                    retries: 0,
                  },
                },
                consumer: {
                  groupId,
                  allowAutoTopicCreation: false,
                },
                subscribe: {
                  fromBeginning: false,
                },
              },
            };
          } catch {
            console.warn(
              'Analytics Kafka configuration failed, using fallback:',
            );
            // Return minimal configuration that won't break startup
            return {
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId: 'analytics-fallback',
                  brokers: ['localhost:9099'], // dummy broker ที่ไม่มี
                },
                consumer: {
                  groupId: 'analytics-fallback',
                },
              },
            };
          }
        },
      },
    ]),
  ],
  providers: [CompanyDayAnalyticService],
  exports: [CompanyDayAnalyticService],
})
export class CompanyDayAnalyticModule {}
