import { Module } from '@nestjs/common';
import { BannerService } from './banner.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BannerEntity } from './banner.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BannerEntity])],
  providers: [BannerService],
  exports: [BannerService],
})
export class BannerModule {}
