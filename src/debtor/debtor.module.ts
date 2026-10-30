import { Module } from '@nestjs/common';
import { DebtorService } from './debtor.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DebtorEntity } from './debtor.entity';
import { DebtorDetailEntity } from './debtor-detail.entity';
import { ReductionRTDetail } from './reduct-rt-detail.entity';
import { ReductionRT } from './reduct-rt.entity';
import { SaleReceivablesSyncService } from './sale-receivables-sync.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebtorEntity,
      DebtorDetailEntity,
      ReductionRT,
      ReductionRTDetail,
    ]),
  ],
  providers: [DebtorService, SaleReceivablesSyncService],
  exports: [DebtorService],
})
export class DebtorModule {}
