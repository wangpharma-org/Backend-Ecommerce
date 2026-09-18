import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { PreorderCampaignEntity } from './preorder-campaign.entity';
import { PreorderProductEntity } from './preorder-product.entity';
import { PreorderItemEntity } from './preorder-item.entity';
import { PreorderItemLogEntity } from './preorder-item-log.entity';
import { PreorderItemLotEntity } from './preorder-item-lot.entity';
import { PreorderService } from './preorder.service';
import { PreorderController } from './preorder.controller';
import { PreorderNotifierService } from './preorder-notifier.service';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ProductEntity } from '../products/products.entity';
import { UserEntity } from '../users/users.entity';
import { ShoppingCartModule } from '../shopping-cart/shopping-cart.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PreorderCampaignEntity,
      PreorderProductEntity,
      PreorderItemEntity,
      PreorderItemLogEntity,
      PreorderItemLotEntity,
      ProductEntity,
      UserEntity,
    ]),
    HttpModule,
    FeatureFlagsModule,
    ShoppingCartModule,
  ],
  providers: [PreorderService, PreorderNotifierService],
  controllers: [PreorderController],
  exports: [PreorderService],
})
export class PreorderModule {}
