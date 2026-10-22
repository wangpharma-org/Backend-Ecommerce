import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { UserEntity } from '../users/users.entity';
import { ProductsModule } from '../products/products.module';
import { StoreVisibilityModule } from '../store-visibility/store-visibility.module';
import { DhlTrackingModule } from '../dhl-tracking/dhl-tracking.module';
import { OrderStatusV2Service } from './order-status-v2.service';
import { OrderAccessService } from './order-access.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingHeadEntity,
      ShoppingOrderEntity,
      UserEntity,
    ]),
    ProductsModule,
    StoreVisibilityModule,
    DhlTrackingModule,
    HttpModule,
    ConfigModule,
  ],
  providers: [OrderStatusV2Service, OrderAccessService],
  exports: [OrderStatusV2Service, OrderAccessService],
})
export class OrderStatusV2Module {}
