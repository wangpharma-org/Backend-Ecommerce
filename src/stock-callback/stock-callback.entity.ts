import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const STOCK_CALLBACK_STATUSES = ['open', 'contacted', 'closed'] as const;
export type StockCallbackStatus = (typeof STOCK_CALLBACK_STATUSES)[number];

/// ECWC-766: ลูกค้ากด "แจ้งฝ่ายขายให้ติดต่อกลับ" ตอนสั่งเกินสต็อก
/// ร้าน + สินค้าเดียวกันที่ยังเปิดอยู่ = แถวเดียว (กดซ้ำนับ request_count และอัปเดตจำนวนล่าสุด)
@Entity({ name: 'stock_callback_request' })
@Index('IDX_stock_callback_member_product', ['mem_code', 'pro_code', 'status'])
@Index('IDX_stock_callback_status', ['status', 'last_requested_at'])
export class StockCallbackRequestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 30 })
  mem_code!: string;

  @Column({ type: 'varchar', length: 30 })
  pro_code!: string;

  /** หน่วยที่ลูกค้ากดเพิ่ม */
  @Column({ type: 'varchar', length: 100, nullable: true })
  unit_name!: string | null;

  /** จำนวนที่กดเพิ่มครั้งล่าสุด (หน่วยตาม unit_name) */
  @Column({ type: 'int' })
  requested_amount!: number;

  /** ของในตะกร้า + ที่กดเพิ่ม (หน่วยเล็กสุด) = จำนวนที่ลูกค้าต้องการทั้งหมด */
  @Column({ type: 'int' })
  requested_smallest!: number;

  /** สต็อกตอนกด (หน่วยเล็กสุด) */
  @Column({ type: 'int' })
  stock_smallest!: number;

  @Column({ type: 'int', default: 1 })
  request_count!: number;

  @Column({ type: 'varchar', length: 20, default: 'open' })
  status!: StockCallbackStatus;

  @Column({ type: 'varchar', length: 30, nullable: true })
  handled_by_emp!: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  handled_by_name!: string | null;

  @Column({ type: 'datetime', nullable: true })
  handled_at!: Date | null;

  @Column({ type: 'text', nullable: true })
  note!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  channel!: string | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @Column({ type: 'datetime' })
  last_requested_at!: Date;
}
