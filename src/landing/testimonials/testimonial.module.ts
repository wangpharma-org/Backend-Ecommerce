import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TestimonialEntity } from './testimonial.entity';
import { TestimonialService } from './testimonial.service';
import { TestimonialController } from './testimonial.controller';
import { FeatureFlagsModule } from '../../feature-flags/feature-flags.module';

@Module({
  imports: [TypeOrmModule.forFeature([TestimonialEntity]), FeatureFlagsModule],
  controllers: [TestimonialController],
  providers: [TestimonialService],
  exports: [TestimonialService],
})
export class TestimonialModule {}
