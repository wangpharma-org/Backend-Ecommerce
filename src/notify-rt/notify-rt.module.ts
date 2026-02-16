import { Module } from '@nestjs/common';
import { NotifyRtService } from './notify-rt.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ShoppingOrderEntity])],
  providers: [NotifyRtService],
  exports: [NotifyRtService],
})
export class NotifyRtModule {}
