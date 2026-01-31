import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SiteConfigEntity } from './site-config.entity';
import { SiteConfigService } from './site-config.service';
import { SiteConfigController } from './site-config.controller';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([SiteConfigEntity]), FeatureFlagsModule],
  controllers: [SiteConfigController],
  providers: [SiteConfigService],
  exports: [SiteConfigService],
})
export class SiteConfigModule {}
