import { Module } from '@nestjs/common';
import { LotService } from './lot.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LotEntity } from './lot.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LotEntity])],
  providers: [LotService],
  exports: [LotService],
})
export class LotModule {}
