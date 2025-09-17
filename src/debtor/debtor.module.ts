import { Module } from '@nestjs/common';
import { DebtorService } from './debtor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtorEntity } from './debtor.entity';

@Module({
  imports: [TypeOrmModule.forFeature([DebtorEntity])],
  providers: [DebtorService],
  exports: [DebtorService],
})
export class DebtorModule {}
