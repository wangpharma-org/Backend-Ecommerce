import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { SEARCH_CART_TRACKING_KAFKA_CLIENT } from './search-cart-tracking.constants';
import { SearchCartTrackingService } from './search-cart-tracking.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    FeatureFlagsModule,
    ClientsModule.registerAsync([
      {
        name: SEARCH_CART_TRACKING_KAFKA_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => {
          try {
            const brokers = (
              configService.get<string>('KAFKA_SEARCH_CART_TRACKING_BROKERS') ||
              configService.get<string>('KAFKA_BROKERS_SECOND') ||
              'localhost:9093'
            )
              .split(',')
              .map((broker) => broker.trim())
              .filter(Boolean);

            const groupId =
              configService.get<string>(
                'KAFKA_SEARCH_CART_TRACKING_GROUP_ID',
              ) || 'consumer-search-cart-tracking';

            const clientId =
              configService.get<string>(
                'KAFKA_SEARCH_CART_TRACKING_CLIENT_ID',
              ) || 'backend-ecommerce-search-cart-tracking';

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
            return {
              transport: Transport.KAFKA,
              options: {
                client: {
                  clientId: 'search-cart-tracking-fallback',
                  brokers: ['localhost:9099'],
                },
                consumer: {
                  groupId: 'search-cart-tracking-fallback',
                },
              },
            };
          }
        },
      },
    ]),
  ],
  providers: [SearchCartTrackingService],
  exports: [SearchCartTrackingService],
})
export class SearchCartTrackingModule {}
