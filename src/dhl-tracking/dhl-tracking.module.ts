import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { DhlTrackingController } from './dhl-tracking.controller';
import { DhlTrackingEntity } from './dhl-tracking.entity';
import { DhlTrackingService } from './dhl-tracking.service';

@Module({
  imports: [TypeOrmModule.forFeature([DhlTrackingEntity, ShoppingHeadEntity])],
  controllers: [DhlTrackingController],
  providers: [DhlTrackingService],
})
export class DhlTrackingModule {}
