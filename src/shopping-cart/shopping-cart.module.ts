import { PromotionEntity } from './../promotion/promotion.entity';
import { forwardRef, Module } from '@nestjs/common';
import { ShoppingCartService } from './shopping-cart.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { ProductsModule } from '../products/products.module';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { HotdealModule } from 'src/hotdeal/hotdeal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingCartEntity,
      PromotionEntity,
      PromotionConditionEntity,
      PromotionTierEntity,
    ]),
    ProductsModule,
    forwardRef(() => HotdealModule),
  ],
  providers: [ShoppingCartService],
  exports: [ShoppingCartService],
})
export class ShoppingCartModule {}
