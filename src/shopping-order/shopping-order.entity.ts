import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ProductEntity } from '../products/products.entity';

@Entity({ name: 'shopping_order' })
export class ShoppingOrderEntity {
  @PrimaryGeneratedColumn()
  spo_id: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_qty: number;

  @Column({ length: 20, nullable: true })
  spo_unit: string;

  @Column({
    type: 'enum',
    enum: ['1', '2', '3'],
    nullable: true,
    default: null,
  })
  spo_unit_enum!: '1' | '2' | '3' | null;

  // @Column({ name: 'soh_running', length: 20, nullable: true })
  // soh_running: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_price_unit: number;

  // @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  // spo_ppu: number;

  @Column({ length: 20, nullable: true })
  pro_code: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_total_decimal: number;

  /**
   * ราคาปกติต่อหน่วยจาก price list ก่อนหักส่วนลด (ECWC-567)
   * ต่างจาก spo_price_unit ตรงที่ตัวนั้นเป็นราคาที่เก็บจริงหลังลดแล้ว
   */
  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_price_list: number | null;

  /**
   * ส่วนลดของบรรทัดเป็นเปอร์เซ็นต์ — 0 = ขายราคาปกติ · 100 = ของแถม
   * ใช้แสดงบนบิลเท่านั้น ยอดที่เก็บจริงคือ spo_total_decimal ห้ามคำนวณใหม่จาก %
   * เพราะ % เก็บได้ 2 ตำแหน่ง บรรทัดมูลค่าสูงจะคลาดเคลื่อนถึงหลักบาท
   */
  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  spo_discount: number | null;

  @Column({ type: 'boolean', default: false, nullable: true })
  is_rt: boolean;

  @Column({ type: 'date', nullable: true, default: null })
  rt_date: Date;

  @Column({ type: 'int', nullable: true })
  promotion_id: number;

  @Column({ type: 'int', nullable: true })
  tier_id: number;

  @Column({ type: 'boolean', default: false })
  is_reward: boolean;

  @ManyToOne(() => ShoppingHeadEntity, (header) => header.details)
  @JoinColumn({ name: 'soh_running', referencedColumnName: 'soh_running' })
  orderHeader: ShoppingHeadEntity;

  @ManyToOne(() => ProductEntity, (product) => product.inOrders)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;

  @Column({ type: 'boolean', default: false })
  is_happy_hour?: boolean;
}
