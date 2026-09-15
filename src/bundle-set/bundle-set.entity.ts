import {
  Entity,
  PrimaryColumn,
  Column,
  OneToMany,
  DeleteDateColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { BundleSetItemEntity } from './bundle-set-item.entity';

/** กระเช้า/ชุดสำเร็จ — ราคาเดียว ยกชุด แบ่งขายไม่ได้ */
@Entity({ name: 'bundle_set' })
export class BundleSetEntity {
  @PrimaryColumn({ length: 30 })
  set_code!: string;

  @Column({ length: 200 })
  set_name!: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  /** ราคาขายของทั้งชุด (ไม่ใช่ผลรวมรายชิ้น) */
  @Column({ type: 'decimal', precision: 16, scale: 2 })
  price!: number;

  @Column({ length: 500, nullable: true })
  image?: string;

  @Column({ default: false })
  status!: boolean;

  @Column({ type: 'datetime', nullable: true })
  start_date?: Date;

  @Column({ type: 'datetime', nullable: true })
  end_date?: Date;

  /** ผูกกับโปรได้ ถ้าอยากให้ยอดชุดนับเข้าเงื่อนไขโปรนั้น */
  @Column({ type: 'int', nullable: true })
  promo_id?: number;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => BundleSetItemEntity, (item) => item.set, { cascade: true })
  items!: BundleSetItemEntity[];
}
