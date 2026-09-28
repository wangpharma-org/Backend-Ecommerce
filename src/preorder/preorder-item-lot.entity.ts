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

/**
 * "ล็อต" ของรายการจอง: จำนวนหนึ่งก้อนพร้อมเวลาที่ก้อนนั้นเข้าคิว
 * รายการจอง 1 แถวมีอย่างน้อย 1 ล็อต ผลรวม qty ของทุกล็อต = item.amount เสมอ
 * - จองครั้งแรก = ล็อตแรก (เวลาจองครั้งแรก)
 * - เพิ่มจำนวนภายหลัง: ขึ้นกับ increase_policy ของรอบ ว่าจะรวมเข้าล็อตแรก (keep)
 *   หรือเปิดล็อตใหม่ ณ เวลาที่เพิ่ม (split) หรือย้ายทั้งรายการไปท้ายคิว (reset)
 * - ลดจำนวน: ตัดจากล็อตหลังสุดก่อน (ส่วนที่จองก่อนคงคิวไว้)
 * คิวและการจัดสรรแบบ fifo ไล่ตามล็อต ไม่ใช่ตามรายการ
 */
@Entity({ name: 'preorder_item_lots' })
@Index('IDX_preorder_item_lots_queue', ['ordered_at', 'id'])
export class PreorderItemLotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_preorder_item_lots_item')
  @Column({ type: 'int' })
  item_id!: number;

  @ManyToOne(() => PreorderItemEntity, (i) => i.lots, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'item_id',
    foreignKeyConstraintName: 'FK_preorder_item_lots_item',
  })
  item!: PreorderItemEntity;

  @Column({ type: 'int' })
  qty!: number;

  /** เวลาที่ล็อตนี้เข้าคิว */
  @Column({ type: 'datetime', precision: 6 })
  ordered_at!: Date;

  @Column({ type: 'int', nullable: true })
  allocated_qty!: number | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;
}
