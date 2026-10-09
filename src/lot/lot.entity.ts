import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';

// ECWC-643: lot 1 ตัว = pro_code + lot + mfg + exp — ใช้เป็น conflict key ของ upsert
@Index('UQ_lot_pro_code_lot_mfg_exp', ['product', 'lot', 'mfg', 'exp'], {
  unique: true,
})
@Entity({ name: 'lot' })
export class LotEntity {
  @PrimaryGeneratedColumn()
  lot_id: number;

  // NOT NULL DEFAULT '' เพราะ NULL ไม่ถูกนับว่าซ้ำใน unique index
  @Column({ type: 'varchar', length: 50, default: '' })
  lot: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  mfg: string;

  @Column({ type: 'varchar', length: 20, default: '' })
  exp: string;

  // ECWC-643: เก็บประวัติ lot — lot ที่ไม่ได้ถูกส่งมาในรอบล่าสุดจะถูกปิด (false) แทนการลบทิ้ง
  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  // ECWC-643: จำนวนรับเข้า (หน่วยเล็กสุด) + วันที่รับของ จาก new-arrivals — NULL ถ้ามาจาก add-lots อย่างเดียว
  @Column({ type: 'int', nullable: true })
  amount!: number | null;

  @Column({ type: 'datetime', nullable: true })
  received_at!: Date | null;

  @CreateDateColumn({ nullable: true })
  created_at: Date;

  @UpdateDateColumn({ nullable: true })
  updated_at: Date;

  @ManyToOne(() => ProductEntity, (product) => product.lot)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
