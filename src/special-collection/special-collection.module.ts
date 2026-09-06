import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SpecialCollectionEntity } from './special-collection.entity';
import { SpecialCollectionItemEntity } from './special-collection-item.entity';
import { SpecialCollectionAudienceEntity } from './special-collection-audience.entity';
import { SpecialCollectionService } from './special-collection.service';
import { SpecialCollectionController } from './special-collection.controller';
import { SpecialCollectionCustomerController } from './special-collection-customer.controller';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { ProductEntity } from 'src/products/products.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import { FlashSaleEntity } from 'src/flashsale/flashsale.entity';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SpecialCollectionEntity,
      SpecialCollectionItemEntity,
      SpecialCollectionAudienceEntity,
      PromotionEntity,
      PromotionTierEntity,
      ProductEntity,
      HotdealEntity,
      FlashSaleEntity,
    ]),
    AuthModule,
  ],
  providers: [SpecialCollectionService],
  controllers: [
    SpecialCollectionController,
    SpecialCollectionCustomerController,
  ],
  exports: [SpecialCollectionService],
})
export class SpecialCollectionModule {}
