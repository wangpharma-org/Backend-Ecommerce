import { Module } from '@nestjs/common';
import { NewArrivalsService } from './new-arrivals.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewArrival } from './new-arrival.entity';
import { ProductsModule } from 'src/products/products.module';
import { UserEntity } from 'src/users/users.entity';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { PreorderModule } from 'src/preorder/preorder.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([NewArrival, UserEntity]),
    ProductsModule,
    PreorderModule,
    ClientsModule.registerAsync([
      {
        name: 'OrderPickingService',
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              brokers: (
                configService.get<string>('KAFKA_BROKERS') || 'localhost:9092'
              ).split(','),
            },
            consumer: {
              groupId: 'consumer-order-picking',
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [NewArrivalsService],
  exports: [NewArrivalsService],
})
export class NewArrivalsModule {}
