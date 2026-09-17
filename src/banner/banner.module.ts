import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BannerEntity } from './banner.entity';
import { PromotionEntity } from 'src/promotion/promotion.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BannerEntity, PromotionEntity])],
  providers: [BannerService],
  exports: [BannerService],
})
export class BannerModule {}
