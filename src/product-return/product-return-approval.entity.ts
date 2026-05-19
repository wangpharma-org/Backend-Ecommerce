import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProductReturnEntity } from './product-return.entity';
import { ReturnStatus, ApprovalAction, ApproverRole } from './return-enums';

@Entity('product_return_approvals')
export class ProductReturnApprovalEntity {
  @PrimaryGeneratedColumn()
  approval_id: number;

  @Index()
  @ManyToOne(() => ProductReturnEntity, (ret) => ret.approvals, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'return_id' })
  returnRequest: ProductReturnEntity;

  @Column()
  return_id: number;

  @Column({
    type: 'enum',
    enum: ApprovalAction,
  })
  action: ApprovalAction;

  @Column({
    type: 'enum',
    enum: ApproverRole,
  })
  approver_role: ApproverRole;

  @Column({ type: 'varchar', length: 30, nullable: true })
  approver_code: string; // mem_code or emp_code

  @Column({ type: 'varchar', length: 100, nullable: true })
  approver_name: string;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
  })
  from_status: ReturnStatus;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
  })
  to_status: ReturnStatus;

  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn()
  action_at: Date;
}
