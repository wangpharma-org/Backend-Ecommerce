import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  Checklist,
  RejectReason,
  ResetRequestStatus,
} from './password-reset.rules';

/**
 * ECWC-706 คำขอรีเซ็ตรหัสผ่านที่ต้องให้พนักงานขายโทรยืนยันตัวตน
 * - mem_code เป็น null เมื่อบัญชีที่กรอกไม่ตรงกับร้านในระบบ — ยังบันทึกไว้เพื่อให้ผู้ส่งเห็นผลเหมือนกันทุกกรณี
 *   (กันการเดาว่าบัญชีไหนมีอยู่จริง) พนักงานไม่เห็นแถวเหล่านี้
 * - temp_password_hash = hash ที่ตั้งให้บัญชีตอนรีเซ็ต ถ้า users.mem_password ยังเท่ากับค่านี้
 *   แปลว่ายังใช้รหัสชั่วคราวอยู่ (ถ้าลูกค้าเปลี่ยนรหัสผ่านทางอื่นไปแล้ว ค่าจะไม่ตรงเอง)
 */
@Entity({ name: 'password_reset_request' })
@Index('IDX_password_reset_mem_status', ['mem_code', 'status'])
@Index('IDX_password_reset_account_created', ['input_account', 'created_at'])
@Index('IDX_password_reset_ip_created', ['ip_address', 'created_at'])
export class PasswordResetRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('UQ_password_reset_ref_code', { unique: true })
  @Column({ type: 'varchar', length: 16 })
  ref_code: string;

  @Column({ type: 'varchar', length: 30, nullable: true, default: null })
  mem_code: string | null;

  /** สิ่งที่ลูกค้ากรอก (ตัวพิมพ์เล็ก) ใช้นับจำนวนคำขอ */
  @Column({ type: 'varchar', length: 60 })
  input_account: string;

  @Column({ type: 'boolean', default: false })
  phone_changed: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  callback_phone: string | null;

  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  ip_address: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  user_agent: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
  })
  status: ResetRequestStatus;

  @Column({ type: 'datetime' })
  expires_at: Date;

  /** รหัสพนักงาน (employee.emp_code) ที่ยืนยัน/ปฏิเสธ — มาจาก sale service */
  @Column({ type: 'varchar', length: 30, nullable: true, default: null })
  handled_by: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  handled_by_name: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  handled_at: Date | null;

  @Column({ type: 'json', nullable: true, default: null })
  checklist: Checklist | null;

  @Column({ type: 'varchar', length: 20, nullable: true, default: null })
  reject_reason: RejectReason | null;

  @Column({ type: 'text', nullable: true, default: null })
  note: string | null;

  @Column({
    type: 'enum',
    enum: ['auto', 'manual'],
    nullable: true,
    default: null,
  })
  password_mode: 'auto' | 'manual' | null;

  /** บังคับตั้งรหัสใหม่ตอนเข้าสู่ระบบ — ปิดได้เฉพาะ admin */
  @Column({ type: 'boolean', default: true })
  force_change: boolean;

  /** ตอนรีเซ็ต ออกจากระบบทุกเครื่องของร้านหรือไม่ — ไม่ออกได้เฉพาะหัวหน้าเลือก */
  @Column({ type: 'boolean', default: true })
  sessions_revoked: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  temp_password_hash: string | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  temp_expires_at: Date | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  password_changed_at: Date | null;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}
