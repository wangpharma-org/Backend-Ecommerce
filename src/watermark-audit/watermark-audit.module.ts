import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WatermarkAuditEntity } from './watermark-audit.entity';
import { WatermarkAuditArchiveEntity } from './watermark-audit-archive.entity';
import { WatermarkAuditService } from './watermark-audit.service';
import { WatermarkAuditController } from './watermark-audit.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WatermarkAuditEntity,
      WatermarkAuditArchiveEntity,
    ]),
    FeatureFlagsModule,
  ],
  providers: [WatermarkAuditService],
  controllers: [WatermarkAuditController],
  exports: [WatermarkAuditService],
})
export class WatermarkAuditModule {}
