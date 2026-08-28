import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { ProductsModule } from '../products/products.module';
import { OrderStatusV2Service } from './order-status-v2.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingHeadEntity, ShoppingOrderEntity]),
    ProductsModule,
    HttpModule,
    ConfigModule,
  ],
  providers: [OrderStatusV2Service],
  exports: [OrderStatusV2Service],
})
export class OrderStatusV2Module {}
