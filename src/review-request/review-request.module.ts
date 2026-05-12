import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { ReviewRequestEntity } from './review-request.entity';
import { ReviewRequestService } from './review-request.service';
import { ReviewRequestController } from './review-request.controller';
import { ReviewRequestListener } from './review-request.listener';

@Module({
  imports: [TypeOrmModule.forFeature([ReviewRequestEntity]), FeatureFlagsModule],
  providers: [ReviewRequestService],
  controllers: [ReviewRequestController, ReviewRequestListener],
  exports: [ReviewRequestService],
})
export class ReviewRequestModule {}
