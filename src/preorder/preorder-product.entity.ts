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
import { ProductEntity } from '../products/products.entity';
import { PreorderCampaignEntity } from './preorder-campaign.entity';
import { PreorderItemEntity } from './preorder-item.entity';

/** สินค้าที่เปิดจองในรอบหนึ่ง (แทนธง product.pro_pre ของระบบเดิม) */
@Entity({ name: 'preorder_products' })
@Index('UQ_preorder_products_campaign_pro', ['campaign_id', 'pro_code'], {
  unique: true,
})
export class PreorderProductEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  campaign_id!: number;

  @ManyToOne(() => PreorderCampaignEntity, (c) => c.products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'campaign_id' })
  campaign!: PreorderCampaignEntity;

  @Column({ type: 'varchar', length: 20 })
  pro_code!: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'pro_code' })
  product!: ProductEntity;

  /** ข้อความสั้นบนการ์ด (เดิม peo_Pnew.penn_detial) */
  @Column({ type: 'varchar', length: 500, nullable: true })
  note!: string | null;

  /** โหมด A: จำนวนสูงสุดที่ร้านหนึ่งจองได้ (หน่วยตาม unit ของสินค้า) */
  @Column({ type: 'int', nullable: true })
  limit_per_member!: number | null;

  /** โหมด A: จำนวนที่จะได้จริงในรอบนี้ ใช้แสดง "จองแล้ว X จาก Y" และตัดเมื่อเต็ม */
  @Column({ type: 'int', nullable: true })
  supply_qty!: number | null;

  /** โหมด B: ยอดรวมขั้นต่ำที่จะสั่งผู้ผลิต */
  @Column({ type: 'int', nullable: true })
  moq!: number | null;

  /** ราคาโดยประมาณต่อหน่วย (null = ใช้ราคาตามระดับ A/B/C ปกติ) */
  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  estimated_price!: string | null;

  /** วันที่คาดว่าของถึงคลัง */
  @Column({ type: 'date', nullable: true })
  eta_date!: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'boolean', default: true })
  is_active!: boolean;

  /** เวลาที่ระบบรับของแจ้งว่าสินค้านี้เข้าคลังแล้ว (จาก new-arrivals) */
  @Column({ type: 'datetime', nullable: true })
  arrived_at!: Date | null;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;

  @OneToMany(() => PreorderItemEntity, (i) => i.preorderProduct)
  items!: PreorderItemEntity[];
}
