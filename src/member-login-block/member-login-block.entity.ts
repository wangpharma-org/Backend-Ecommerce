import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// SSN0-273: สถานะระงับการเข้าใช้งาน E-commerce ของแต่ละร้าน (sale เป็นคนสั่งผ่าน sale-backend)
// แยกจากตาราง users เพราะ users ถูก upsert จาก ERP — ไม่ให้ sync ทับสถานะที่ sale ตั้งไว้
// ไม่มีแถว = ไม่ถูกระงับ · ประวัติทั้งหมดอยู่ที่ member_login_block_log
@Entity({ name: 'member_login_block' })
export class MemberLoginBlockEntity {
  @PrimaryColumn({ length: 30 })
  mem_code: string;

  @Column({ type: 'boolean', default: false })
  is_blocked: boolean;

  // เหตุผลที่ลูกค้าเห็นตอน login ไม่ได้ — ล้างเป็น null ตอนยกเลิกระงับ
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  reason: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  blocked_by_emp_code: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  blocked_by_name: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  blocked_at: Date | null;

  @UpdateDateColumn()
  updated_at: Date;
}
