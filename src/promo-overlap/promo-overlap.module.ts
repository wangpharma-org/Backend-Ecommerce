import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HotdealEntity } from '../hotdeal/hotdeal.entity';
import { PromotionConditionEntity } from '../promotion/promotion-condition.entity';
import { PromoOverlapService } from './promo-overlap.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([HotdealEntity, PromotionConditionEntity]),
  ],
  providers: [PromoOverlapService],
  exports: [PromoOverlapService],
})
export class PromoOverlapModule {}
