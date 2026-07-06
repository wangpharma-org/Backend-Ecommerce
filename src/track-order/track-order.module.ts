import { Module } from '@nestjs/common';
import { TrackOrderService } from './track-order.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [TrackOrderService],
  exports: [TrackOrderService],
})
export class TrackOrderModule {}
