import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * snapshot ของกระเช้า ณ ตอนออกออเดอร์ (ECWC-525)
 *
 * cart_basket ถูกลบไปพร้อมตะกร้าหลังสั่ง แถวนี้จึงเป็นที่เดียวที่บอกว่า
 * ออเดอร์ไหนขายกระเช้า/ชุดอะไรไปกี่ชุด ราคาชุดเท่าไหร่ — ใช้ทำรายงานยอดขายรายชุด
 * บรรทัดใน shopping_order ที่มาจากกระเช้าเดียวกันมี spo_basket_id ตรงกับ basket_id ที่นี่
 * กระเช้าที่ถูกแบ่งข้าม 2 ออเดอร์ (เกิน 80 รายการ) จะมีแถวละออเดอร์ รวมเฉพาะบรรทัดในออเดอร์นั้น
 */
@Entity({ name: 'order_basket' })
export class OrderBasketEntity {
  @PrimaryGeneratedColumn()
  order_basket_id!: number;

  @Index()
  @Column({ length: 20 })
  soh_running!: string;

  /** basket_id เดิมใน cart_basket — ไม่มี FK เพราะแถวต้นทางถูกลบแล้ว */
  @Index()
  @Column({ type: 'int' })
  basket_id!: number;

  @Column({ type: 'varchar', length: 10 })
  kind!: 'promo' | 'set';

  @Column({ type: 'int', nullable: true, default: null })
  promo_id!: number | null;

  @Index()
  @Column({ type: 'varchar', length: 30, nullable: true, default: null })
  set_code!: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true, default: null })
  set_name!: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  set_qty!: number | null;

  /** ราคาต่อ 1 ชุด ณ ตอนสั่ง (bundle_set.price ตอนนั้น) */
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    nullable: true,
    default: null,
  })
  set_price!: number | null;

  @Column({ type: 'int' })
  line_count!: number;

  /** ผลรวม spo_total_decimal ของบรรทัดจากกระเช้านี้ในออเดอร์นี้ */
  @Column({ type: 'decimal', precision: 16, scale: 2 })
  total_amount!: number;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;
}
