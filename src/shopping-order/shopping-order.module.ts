import { PromotionRewardEntity } from './../promotion/promotion-reward.entity';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { ShoppingOrderService } from './shopping-order.service';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';
import { ShoppingHeadEntity } from './../shopping-head/shopping-head.entity';
import { HttpModule } from '@nestjs/axios';
import { FailedEntity } from '../failed-api/failed-api.entity';
import { ProductEntity } from '../products/products.entity';
import { SaleLogEntity } from './salelog-order.entity';
import { UserEntity } from 'src/users/users.entity';
import { LoggerModule } from '../logger/logger.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingOrderEntity,
      ShoppingHeadEntity,
      FailedEntity,
      ProductEntity,
      SaleLogEntity,
      PromotionRewardEntity,
      UserEntity,
    ]),
    ShoppingCartModule,
    HttpModule,
    LoggerModule,
  ],
  providers: [ShoppingOrderService],
  exports: [ShoppingOrderService],
})
export class ShoppingOrderModule {}
