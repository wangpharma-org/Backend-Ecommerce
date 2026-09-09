import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PreorderItemEntity } from './preorder-item.entity';

export enum PreorderLogAction {
  CREATE = 'create',
  UPDATE = 'update',
  LOCK = 'lock',
  UNLOCK = 'unlock',
  ALLOCATE = 'allocate',
  PAID = 'paid',
  UNPAID = 'unpaid',
  CANCEL = 'cancel',
  FULFILL = 'fulfill',
  ARRIVED_NOTIFY = 'arrived_notify',
}

/** ประวัติการเปลี่ยนแปลงรายการจอง ใครแก้ เมื่อไหร่ จากเท่าไหร่เป็นเท่าไหร่ */
@Entity({ name: 'preorder_item_logs' })
export class PreorderItemLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'int' })
  item_id!: number;

  @ManyToOne(() => PreorderItemEntity, (i) => i.logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: PreorderItemEntity;

  /** mem_code ของลูกค้า หรือ username ของ admin */
  @Column({ type: 'varchar', length: 50 })
  actor!: string;

  @Column({ type: 'enum', enum: PreorderLogAction })
  action!: PreorderLogAction;

  @Column({ type: 'int', nullable: true })
  from_amount!: number | null;

  @Column({ type: 'int', nullable: true })
  to_amount!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;
}
