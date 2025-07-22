import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FailedEntity } from './failed-api.entity';
import { FeatureFlagEntity } from './feature_flag.entity';

@Module({
  imports: [TypeOrmModule.forFeature([FailedEntity, FeatureFlagEntity])],
})
export class FailedApiModule {}
