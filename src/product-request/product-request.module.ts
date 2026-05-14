import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductRequestEntity } from './product-request.entity';
import { ProductRequestService } from './product-request.service';
import { ProductRequestController } from './product-request.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductRequestEntity]),
    FeatureFlagsModule,
  ],
  providers: [ProductRequestService],
  controllers: [ProductRequestController],
})
export class ProductRequestModule {}
