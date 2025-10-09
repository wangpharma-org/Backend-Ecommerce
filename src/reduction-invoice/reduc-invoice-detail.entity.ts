import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReductionInvoice } from './reduction-invoice.entity';

@Entity({ name: 'reduction_invoice_detail' })
export class ReductionInvoiceDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: null })
  date: string;

  @Column({ nullable: true, default: null })
  price: string;

  @Column({ nullable: true, default: null })
  sh_running: string;

  @Column({ nullable: true, default: null })
  invoice: string;

  @Column({ nullable: true, default: null })
  due_date: string;

  @ManyToOne(
    () => ReductionInvoice,
    (reductionInvoice) => reductionInvoice.reducDetail,
  )
  @JoinColumn({ name: 'invoice_bill_id' })
  reductionInvoice: ReductionInvoice;
}
