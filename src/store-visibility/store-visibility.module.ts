import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { CustomerStoreVisibilityEntity } from './customer-store-visibility.entity';
import { StoreVisibilityService } from './store-visibility.service';
import { StoreVisibilityController } from './store-visibility.controller';

@Module({
  // JwtAuthGuard ใน controller inject FeatureFlagsService — ต้อง import ไม่งั้น getFlag เป็น undefined
  imports: [
    FeatureFlagsModule,
    TypeOrmModule.forFeature([CustomerStoreVisibilityEntity]),
  ],
  providers: [StoreVisibilityService],
  controllers: [StoreVisibilityController],
  exports: [StoreVisibilityService],
})
export class StoreVisibilityModule {}
