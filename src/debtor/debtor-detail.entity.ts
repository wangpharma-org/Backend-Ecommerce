import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DebtorEntity } from './debtor.entity';

@Entity({ name: 'debtor_detail' })
export class DebtorDetailEntity {
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

  @Column({ nullable: true, default: null })
  invoice_bill_id: string;

  @ManyToOne(() => DebtorEntity, (debtorEntity) => debtorEntity.debtorDetail)
  @JoinColumn({ name: 'invoice_bill_id' })
  debtorEntity: DebtorEntity;
}
