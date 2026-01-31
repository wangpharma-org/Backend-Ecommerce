import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PartnerEntity } from './partner.entity';
import { PartnerService } from './partner.service';
import { PartnerController } from './partner.controller';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([PartnerEntity]), FeatureFlagsModule],
  controllers: [PartnerController],
  providers: [PartnerService],
  exports: [PartnerService],
})
export class PartnerModule {}
