import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaqEntity } from './faq.entity';
import { FaqService } from './faq.service';
import { FaqController } from './faq.controller';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([FaqEntity]), FeatureFlagsModule],
  controllers: [FaqController],
  providers: [FaqService],
  exports: [FaqService],
})
export class FaqModule {}
