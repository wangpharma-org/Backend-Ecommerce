import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { COMPANY_DAY_ANALYTIC_KAFKA_CLIENT } from './company-day-analytic.constants';
import { CompanyDayAnalyticService } from './company-day-analytic.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: COMPANY_DAY_ANALYTIC_KAFKA_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId:
                configService.get<string>('KAFKA_COMPANY_DAY_CLIENT_ID') ||
                'backend-ecommerce-company-day',
              brokers: (
                configService.get<string>('KAFKA_BROKERS') || 'localhost:9092'
              )
                .split(',')
                .map((broker) => broker.trim())
                .filter(Boolean),
            },
            consumer: {
              groupId:
                configService.get<string>('KAFKA_COMPANY_DAY_GROUP_ID') ||
                'backend-ecommerce-company-day-producer',
            },
          },
        }),
      },
    ]),
  ],
  providers: [CompanyDayAnalyticService],
  exports: [CompanyDayAnalyticService],
})
export class CompanyDayAnalyticModule {}
