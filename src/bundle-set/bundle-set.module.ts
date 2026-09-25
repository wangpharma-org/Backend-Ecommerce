import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BundleSetEntity } from './bundle-set.entity';
import { BundleSetItemEntity } from './bundle-set-item.entity';
import { BundleSetService } from './bundle-set.service';
import {
  BundleSetController,
  BundleSetCustomerController,
} from './bundle-set.controller';
import { ProductEntity } from 'src/products/products.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { AuthModule } from 'src/auth/auth.module';
// JwtAuthGuard inject FeatureFlagsService — ต้อง import module นี้ ไม่งั้น guard สร้างไม่ได้ (500)
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BundleSetEntity,
      BundleSetItemEntity,
      ProductEntity,
      ProductUnitEntity,
    ]),
    AuthModule,
    FeatureFlagsModule,
  ],
  providers: [BundleSetService],
  controllers: [BundleSetController, BundleSetCustomerController],
  exports: [BundleSetService],
})
export class BundleSetModule {}
