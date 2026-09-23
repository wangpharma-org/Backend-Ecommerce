import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * ECWC-559 — เลขบิลที่ระบบจัดออเดอร์ (order-picking) ส่งมาให้ แสดงในหน้ารายละเอียดสถานะ
 * หนึ่งคำสั่งจองมีเลขบิลเดียว ส่งซ้ำ = แก้เลขบิลเดิม
 */
@Entity({ name: 'order_bill_number' })
export class OrderBillNumberEntity {
  /** เลขที่คำสั่งจอง (sh_running ฝั่ง order-picking = soh_running ฝั่ง ecom) */
  @PrimaryColumn({ type: 'varchar', length: 60 })
  soh_running!: string;

  @Column({ type: 'varchar', length: 60 })
  bill_number!: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;
}
