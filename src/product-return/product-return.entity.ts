import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ProductReturnItemEntity } from './product-return-item.entity';
import { ProductReturnImageEntity } from './product-return-image.entity';
import { ProductReturnApprovalEntity } from './product-return-approval.entity';
import {
  ReturnStatus,
  ReturnReason,
  ResolutionType,
  InitiatorType,
} from './return-enums';

@Entity('product_returns')
export class ProductReturnEntity {
  @PrimaryGeneratedColumn()
  return_id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  return_running: string; // Format: RTN-YYYYMMDD-XXXXX

  @Index()
  @ManyToOne(() => ShoppingHeadEntity, { nullable: false })
  @JoinColumn({ name: 'soh_id' })
  order: ShoppingHeadEntity;

  @Column()
  soh_id: number;

  @Index()
  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  member: UserEntity;

  @Column({ type: 'varchar', length: 30 })
  mem_code: string;

  @Column({
    type: 'enum',
    enum: ReturnStatus,
    default: ReturnStatus.DRAFT,
  })
  status: ReturnStatus;

  @Column({
    type: 'enum',
    enum: ReturnReason,
  })
  reason: ReturnReason;

  @Column({ type: 'text', nullable: true })
  reason_detail: string;

  @Column({
    type: 'enum',
    enum: ResolutionType,
    nullable: true,
  })
  resolution_type: ResolutionType;

  @Column({
    type: 'enum',
    enum: InitiatorType,
  })
  initiator_type: InitiatorType;

  @Column({ type: 'varchar', length: 30, nullable: true })
  initiator_emp_code: string;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  total_return_amount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => ProductReturnItemEntity, (item) => item.returnRequest, {
    cascade: true,
  })
  items: ProductReturnItemEntity[];

  @OneToMany(() => ProductReturnImageEntity, (image) => image.returnRequest, {
    cascade: true,
  })
  images: ProductReturnImageEntity[];

  @OneToMany(
    () => ProductReturnApprovalEntity,
    (approval) => approval.returnRequest,
    {
      cascade: true,
    },
  )
  approvals: ProductReturnApprovalEntity[];
}
