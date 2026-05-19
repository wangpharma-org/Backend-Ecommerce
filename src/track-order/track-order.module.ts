import { Module } from '@nestjs/common';
import { TrackOrderService } from './track-order.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackOrderEntity } from './track-order.entity';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([TrackOrderEntity]),
    HttpModule,
    ConfigModule,
  ],
  providers: [TrackOrderService],
  exports: [TrackOrderService],
})
export class TrackOrderModule {}
