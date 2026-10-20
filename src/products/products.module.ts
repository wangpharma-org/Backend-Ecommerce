import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ProductsService } from './products.service';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductListner } from './product.listener';
import { CreditorListener } from './creditor.listener';
import { CreditorEntity } from './creditor.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BackendModule } from 'src/backend/backend.module';
import { ImagedebugModule } from 'src/imagedebug/imagedebug.module';
import { UserEntity } from 'src/users/users.entity';
import { ElasticsearchModule } from 'src/elasticsearch/elasticsearch.module';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.entity';
import { ProductUnitEntity } from './product-unit.entity';
import { ProductLabelRulesModule } from 'src/product-label-rules/product-label-rules.module';
import { FixFreeModule } from 'src/fix-free/fix-free.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import {
  MONTHLY_DEAL_KAFKA_CLIENT,
  MonthlyDealPublisherService,
} from './monthly-deal-publisher.service';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductPharmaEntity,
      CreditorEntity,
      LogFileEntity,
      UserEntity,
      ShoppingCartEntity,
      DeleteCartEntity,
      ProductUnitEntity,
    ]),
    BackendModule,
    ImagedebugModule,
    ElasticsearchModule,
    ProductLabelRulesModule,
    FixFreeModule,
    forwardRef(() => ShoppingCartModule),
    ClientsModule.registerAsync([
      {
        name: MONTHLY_DEAL_KAFKA_CLIENT,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: configService.get<string>(
                'KAFKA_CLIENT_ID',
                'ecommerce',
              ),
              brokers: configService
                .get<string>('KAFKA_BROKERS', 'localhost:9092')
                .split(','),
            },
            producerOnlyMode: true,
          },
        }),
      },
    ]),
  ],
  providers: [ProductsService, MonthlyDealPublisherService],
  controllers: [ProductListner, CreditorListener],
  exports: [ProductsService],
})
export class ProductsModule {}
