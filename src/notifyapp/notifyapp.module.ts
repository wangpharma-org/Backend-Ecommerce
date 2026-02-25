import { Module } from '@nestjs/common';
import { NotifyRtService } from './notifyapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingOrderEntity, NotificationTokenEntity]),
  ],
  providers: [NotifyRtService],
  exports: [NotifyRtService],
})
export class NotifyRtModule {}
