import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionEntity } from './promotion.entity';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import { PromotionTierExclusionEntity } from './promotion-tier-exclusion.entity';
import { CreditorEntity } from '../products/creditor.entity';
import { PromotionService } from './promotion.service';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { CodePromotionEntity } from './code-promotion.entity';
import { ShoppingCartModule } from 'src/shopping-cart/shopping-cart.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';
import { PromotionTypePolicyEntity } from './promotion-type-policy.entity';
import { PromoOverlapModule } from 'src/promo-overlap/promo-overlap.module';
import { PromotionController } from './promotion.controller';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotionEntity,
      PromotionTierEntity,
      PromotionConditionEntity,
      PromotionRewardEntity,
      PromotionTierExclusionEntity,
      CreditorEntity,
      ShoppingCartEntity,
      CodePromotionEntity,
      ProductEntity,
      UserEntity,
      PromotionTypePolicyEntity,
    ]),
    ShoppingCartModule,
    AuthModule,
    FeatureFlagsModule,
    PromoOverlapModule,
  ],
  controllers: [PromotionController],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
