import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from '../users/users.entity';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LineOaMonitorService } from './line-oa-monitor.service';
import { LineOaMonitorController } from './line-oa-monitor.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity]), FeatureFlagsModule],
  controllers: [LineOaMonitorController],
  providers: [LineOaMonitorService],
})
export class LineOaMonitorModule {}
