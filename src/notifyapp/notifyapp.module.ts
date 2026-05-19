import { Module } from '@nestjs/common';
import { NotifyRtService } from './notifyapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { NotifyRtController } from './notifyapp.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { UserEntity } from '../users/users.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShoppingOrderEntity,
      NotificationTokenEntity,
      UserEntity,
    ]),
    FeatureFlagsModule,
  ],
  controllers: [NotifyRtController],
  providers: [NotifyRtService],
  exports: [NotifyRtService],
})
export class NotifyRtModule {}
