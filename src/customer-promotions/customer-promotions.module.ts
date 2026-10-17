import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from 'src/users/users.entity';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { PromotionRewardEntity } from 'src/promotion/promotion-reward.entity';
import { PromotionTierExclusionEntity } from 'src/promotion/promotion-tier-exclusion.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import { FlashSaleEntity } from 'src/flashsale/flashsale.entity';
import { BundleSetEntity } from 'src/bundle-set/bundle-set.entity';
import { SpecialCollectionModule } from 'src/special-collection/special-collection.module';
import { HappyHourModule } from 'src/happy-hour/happy-hour.module';
import { WangdayModule } from 'src/wangday/wangday.module';
import { CustomerPromotionsController } from './customer-promotions.controller';
import { CustomerPromotionsService } from './customer-promotions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      PromotionEntity,
      PromotionConditionEntity,
      PromotionRewardEntity,
      PromotionTierExclusionEntity,
      ProductUnitEntity,
      HotdealEntity,
      FlashSaleEntity,
      BundleSetEntity,
    ]),
    SpecialCollectionModule,
    HappyHourModule,
    WangdayModule,
  ],
  controllers: [CustomerPromotionsController],
  providers: [CustomerPromotionsService],
})
export class CustomerPromotionsModule {}
