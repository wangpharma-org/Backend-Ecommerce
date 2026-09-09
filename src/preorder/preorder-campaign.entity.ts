import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PreorderProductEntity } from './preorder-product.entity';

/**
 * โหมดของรอบจอง
 * - allocation  : ของขาด demand > supply ต้องจัดสรร (มี limit ต่อร้าน, supply ของรอบ)
 * - aggregation : รวบรวม demand ก่อนสั่งผู้ผลิต (มี MOQ, ETA, ราคาโดยประมาณ)
 */
export enum PreorderMode {
  ALLOCATION = 'allocation',
  AGGREGATION = 'aggregation',
}

/**
 * นโยบายเมื่อลูกค้า "เพิ่ม" จำนวนหลังจองแล้ว (ลดจำนวนคงคิวเสมอ)
 * - keep  : ส่วนที่เพิ่มได้คิวเดิม
 * - split : ส่วนที่เพิ่มนับเป็นคิวใหม่ ณ เวลาที่เพิ่ม ส่วนเดิมคงคิวเดิม
 * - reset : เพิ่มเมื่อไหร่ ทั้งรายการย้ายไปท้ายคิว
 */
export enum PreorderIncreasePolicy {
  KEEP = 'keep',
  SPLIT = 'split',
  RESET = 'reset',
}

export enum PreorderCampaignStatus {
  DRAFT = 'draft',
  OPEN = 'open',
  CLOSED = 'closed',
  ALLOCATING = 'allocating',
  FULFILLED = 'fulfilled',
  CANCELLED = 'cancelled',
}

@Entity({ name: 'preorder_campaigns' })
export class PreorderCampaignEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({
    type: 'enum',
    enum: PreorderMode,
    default: PreorderMode.AGGREGATION,
  })
  mode!: PreorderMode;

  @Index()
  @Column({
    type: 'enum',
    enum: PreorderCampaignStatus,
    default: PreorderCampaignStatus.DRAFT,
  })
  status!: PreorderCampaignStatus;

  /** เปิดรับจองตั้งแต่ (null = ทันทีที่ status เป็น open) */
  @Column({ type: 'datetime', nullable: true })
  starts_at!: Date | null;

  /** ปิดรับจองเมื่อ (null = จนกว่า admin จะปิดเอง) */
  @Column({ type: 'datetime', nullable: true })
  ends_at!: Date | null;

  /** ประกาศรายละเอียด (เดิม peo_new.detial) */
  @Column({ type: 'text', nullable: true })
  detail_announcement!: string | null;

  /** ข่าวด่วน (เดิม peo_new.breaking) */
  @Column({ type: 'text', nullable: true })
  breaking_announcement!: string | null;

  /** เงื่อนไขที่ลูกค้าต้องยอมรับก่อนจองครั้งแรกของรอบ */
  @Column({ type: 'text', nullable: true })
  terms!: string | null;

  /** ลูกค้ายกเลิกเองได้ไหมระหว่างรอบเปิด (โหมด A ควร false, โหมด B ควร true) */
  @Column({ type: 'boolean', default: false })
  allow_cancel!: boolean;

  @Column({
    type: 'enum',
    enum: PreorderIncreasePolicy,
    default: PreorderIncreasePolicy.KEEP,
  })
  increase_policy!: PreorderIncreasePolicy;

  /** ภายใน N ชั่วโมงหลังจองครั้งแรก เพิ่มจำนวนได้โดยไม่เสียคิว (null = ไม่มีช่วงผ่อนผัน) */
  @Column({ type: 'int', nullable: true })
  increase_grace_hours!: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  created_by!: string | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;

  @OneToMany(() => PreorderProductEntity, (p) => p.campaign)
  products!: PreorderProductEntity[];
}
