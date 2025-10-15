import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { DebtorDetailEntity } from './debtor-detail.entity';

@Entity({ name: 'debtor' })
export class DebtorEntity {
  @PrimaryGeneratedColumn()
  debtor_id: number;

  @Column({ nullable: false })
  billing_slip_id: string;

  @Column({ nullable: false })
  payment_schedule_date: string;

  @Column({ nullable: false })
  total: string;

  @Column({ nullable: true, default: null })
  date: string;

  @Column({ nullable: false })
  payment: string;

  @Column({ nullable: false })
  balance: string;

  @Column({ length: 30 })
  mem_code: string;

  @ManyToOne(() => UserEntity, (user) => user.debtors)
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;

  @OneToMany(
    () => DebtorDetailEntity,
    (debtorDetail) => debtorDetail.debtorEntity,
  )
  debtorDetail: DebtorDetailEntity[];

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
