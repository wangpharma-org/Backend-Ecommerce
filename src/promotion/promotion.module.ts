import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionEntity } from './promotion.entity';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import { CreditorEntity } from '../products/creditor.entity';
import { PromotionService } from './promotion.service';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { CodePromotionEntity } from './code-promotion.entity';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotionEntity,
      PromotionTierEntity,
      PromotionConditionEntity,
      PromotionRewardEntity,
      CreditorEntity,
      ShoppingCartEntity,
      CodePromotionEntity,
      ProductEntity,
      UserEntity,
    ]),
    ShoppingCartModule,
    AuthModule,
  ],
  controllers: [],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
