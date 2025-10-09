import { Module } from '@nestjs/common';
import { ReductionInvoiceService } from './reduction-invoice.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReductionInvoice } from './reduction-invoice.entity';
import { ReductionInvoiceDetail } from './reduc-invoice-detail.entity';
import { UsersModule } from 'src/users/users.module';
import { ReductionInvoiceRT } from './reduct-invoice-rt.entity';
import { ReductionInvoiceRTDetail } from './reduct-invoice-rt-detail.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ReductionInvoice,
      ReductionInvoiceDetail,
      ReductionInvoiceRT,
      ReductionInvoiceRTDetail,
    ]),
    UsersModule,
  ],
  exports: [ReductionInvoiceService],
  providers: [ReductionInvoiceService],
})
export class ReductionInvoiceModule {}
