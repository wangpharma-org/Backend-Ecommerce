import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PreorderProductEntity } from './preorder-product.entity';
import { PreorderItemLogEntity } from './preorder-item-log.entity';
import { PreorderItemLotEntity } from './preorder-item-lot.entity';
import { UserEntity } from '../users/users.entity';

export enum PreorderItemStatus {
  /** จองแล้ว แก้จำนวนได้ */
  RESERVED = 'reserved',
  /** admin ล็อค ลูกค้าแก้ไม่ได้ */
  LOCKED = 'locked',
  /** จัดสรรแล้ว (allocated_qty) รอออกออเดอร์ */
  ALLOCATED = 'allocated',
  /** ออกออเดอร์/ส่งแล้ว */
  FULFILLED = 'fulfilled',
  /** ยกเลิก (ลูกค้าหรือ admin) */
  CANCELLED = 'cancelled',
}

/**
 * รายการจองของร้าน 1 แถวต่อ (รอบ, สินค้า, ร้าน)
 * ordered_at คือเวลาจองครั้งแรก ใช้เรียงคิว และห้ามแก้ตลอดอายุแถว
 */
@Entity({ name: 'preorder_items' })
@Index('UQ_preorder_items_product_mem', ['preorder_product_id', 'mem_code'], {
  unique: true,
})
@Index('IDX_preorder_items_queue', ['preorder_product_id', 'ordered_at'])
export class PreorderItemEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  preorder_product_id!: number;

  @ManyToOne(() => PreorderProductEntity, (p) => p.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'preorder_product_id',
    foreignKeyConstraintName: 'FK_preorder_items_product',
  })
  preorderProduct!: PreorderProductEntity;

  @Index('IDX_preorder_items_mem_code')
  @Column({ type: 'varchar', length: 30 })
  mem_code!: string;

  @ManyToOne(() => UserEntity, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  member!: UserEntity;

  @Column({ type: 'int' })
  amount!: number;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit!: string | null;

  @Column({
    type: 'enum',
    enum: PreorderItemStatus,
    default: PreorderItemStatus.RESERVED,
  })
  status!: PreorderItemStatus;

  @Column({ type: 'int', nullable: true })
  allocated_qty!: number | null;

  @Column({ type: 'boolean', default: false })
  is_paid!: boolean;

  /** ส่งจำนวนที่จัดสรรเข้าตะกร้าลูกค้าแล้วเมื่อ */
  @Column({ type: 'datetime', nullable: true })
  cart_pushed_at!: Date | null;

  @Column({ type: 'datetime', nullable: true })
  accepted_terms_at!: Date | null;

  /** เวลาจองครั้งแรก ห้ามแก้ */
  @Column({ type: 'datetime', precision: 6 })
  ordered_at!: Date;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;

  @OneToMany(() => PreorderItemLogEntity, (l) => l.item)
  logs!: PreorderItemLogEntity[];

  /** ล็อตของจำนวน (ผลรวม qty = amount) เรียงตามเวลาเข้าคิว */
  @OneToMany(() => PreorderItemLotEntity, (l) => l.item)
  lots!: PreorderItemLotEntity[];
}
