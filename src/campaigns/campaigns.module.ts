import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { IdeogramBrowserService } from './ideogram-browser.service';
import { CampaignEntity } from './campaigns.entity';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignRewardEntity } from './campaigns-reward.entity';
import { CampaignsPromoRewardEntity } from './campaigns-promo-reward.entity';
import { PromoProductEntity } from './campaigns-product.entity';
import { CampaignPurchaseProductEntity } from './campaigns-purchase-product.entity';
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
      CampaignPurchaseProductEntity,
      ProductEntity,
    ]),
  ],
  providers: [CampaignsService, IdeogramBrowserService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
