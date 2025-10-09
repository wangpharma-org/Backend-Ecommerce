import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ReductionInvoiceDetail } from './reduc-invoice-detail.entity';
import { UserEntity } from 'src/users/users.entity';

@Entity()
export class ReductionInvoice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: null })
  date: string;

  @Column({ nullable: true, default: null })
  date_due: string;

  @Column({ length: 30 })
  mem_code: string;

  @Column({ nullable: true, default: null })
  invoice: string;

  @Column({ nullable: false })
  total: string;

  @Column({ nullable: false })
  payment: string;

  @Column({ nullable: false })
  balance: string;

  @OneToMany(
    () => ReductionInvoiceDetail,
    (reducDetail) => reducDetail.reductionInvoice,
  )
  @JoinColumn({ name: 'billing_slip_id' })
  reducDetail: ReductionInvoiceDetail[];

  @ManyToOne(() => UserEntity, (user) => user.reductionInvoices)
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;
}
