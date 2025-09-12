import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PromotionEntity } from './promotion.entity';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import { CreditorEntity } from '../products/creditor.entity';
import { PromotionService } from './promotion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PromotionEntity,
      PromotionTierEntity,
      PromotionConditionEntity,
      PromotionRewardEntity,
      CreditorEntity,
    ]),
  ],
  controllers: [],
  providers: [PromotionService],
  exports: [PromotionService],
})
export class PromotionModule {}
