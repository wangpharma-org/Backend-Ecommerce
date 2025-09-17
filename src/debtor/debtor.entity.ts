import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  ManyToOne,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';

@Entity({ name: 'debtor' })
export class DebtorEntity {
  @PrimaryGeneratedColumn()
  debtor_id: number;

  @Column()
  billing_slip_id: string;

  @Column()
  payment_schedule_date: string;

  @Column()
  billing_amount: number;

  @ManyToOne(() => UserEntity, (user) => user.debtors, { eager: true })
  @JoinColumn({ name: 'mem_code' })
  user: UserEntity;
}
