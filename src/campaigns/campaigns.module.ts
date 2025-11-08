import { CampaignsController } from './campaigns.controller';
import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignEntity } from './campaigns.entity';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignRewardEntity } from './campaigns-reward.entity';
import { CampaignsPromoRewardEntity } from './campaigns-promo-reward.entity';
import { PromoProductEntity } from './campaigns-product.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CampaignEntity,
      CampaignRowEntity,
      CampaignRewardEntity,
      CampaignsPromoRewardEntity,
      PromoProductEntity,
      ProductEntity,
    ]),
  ],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
