import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './feature-flags.service';
import { FeatureFlagEntity } from '../failed-api/feature_flag.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagLogEntity } from './feature-flag-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FeatureFlagEntity, FeatureFlagLogEntity]),
  ],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
