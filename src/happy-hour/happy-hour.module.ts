import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HappyHourConfigEntity } from './happy-hour-config.entity';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';
import { HappyHourSlotRewardEntity } from './happy-hour-slot-reward.entity';
import { HappyHourSlotLogEntity } from './happy-hour-slot-log.entity';
import { HappyHourConfigLogEntity } from './happy-hour-config-log.entity';
import { HappyHourService } from './happy-hour.service';
import { HappyHourController } from './happy-hour.controller';
import { FeatureFlagsModule } from 'src/feature-flags/feature-flags.module';
import { AuthModule } from 'src/auth/auth.module';
import { ProductEntity } from 'src/products/products.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HappyHourConfigEntity,
      HappyHourSlotEntity,
      HappyHourSlotRewardEntity,
      HappyHourSlotLogEntity,
      HappyHourConfigLogEntity,
      ProductEntity,
      ProductUnitEntity,
    ]),
    FeatureFlagsModule,
    AuthModule,
  ],
  providers: [HappyHourService],
  controllers: [HappyHourController],
  exports: [HappyHourService],
})
export class HappyHourModule {}
