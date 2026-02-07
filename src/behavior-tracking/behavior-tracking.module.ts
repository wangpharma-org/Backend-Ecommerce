import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackingEventEntity } from './tracking-event.entity';
import { BehaviorTrackingService } from './behavior-tracking.service';
import { ProductEntity } from '../products/products.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TrackingEventEntity, ProductEntity])],
  providers: [BehaviorTrackingService],
  exports: [BehaviorTrackingService],
})
export class BehaviorTrackingModule {}
