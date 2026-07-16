import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { UserEntity } from '../users/users.entity';
import { DeliveryPreferenceService } from './delivery-preference.service';
import { DeliveryPreferenceController } from './delivery-preference.controller';
import { DeliveryPreferenceAdminController } from './delivery-preference-admin.controller';
import { CustomerDeliveryPreferenceEntity } from './customer-delivery-preference.entity';

@Module({
  imports: [
    FeatureFlagsModule,
    TypeOrmModule.forFeature([UserEntity, CustomerDeliveryPreferenceEntity]),
  ],
  providers: [DeliveryPreferenceService],
  controllers: [
    DeliveryPreferenceController,
    DeliveryPreferenceAdminController,
  ],
  exports: [DeliveryPreferenceService],
})
export class DeliveryPreferenceModule {}
