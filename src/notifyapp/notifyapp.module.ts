import { Module } from '@nestjs/common';
import { NotifyRtService } from './notifyapp.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';
import { NotificationTokenEntity } from './notification-token.entity';
import { NotifyRtController } from './notifyapp.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([ShoppingOrderEntity, NotificationTokenEntity]),
  ],
  controllers: [NotifyRtController],
  providers: [NotifyRtService],
  exports: [NotifyRtService],
})
export class NotifyRtModule {}
