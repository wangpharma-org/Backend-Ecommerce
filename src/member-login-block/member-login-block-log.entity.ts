import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type MemberLoginBlockAction = 'BLOCK' | 'UNBLOCK';

export const MEMBER_LOGIN_BLOCK_ACTIONS: MemberLoginBlockAction[] = [
  'BLOCK',
  'UNBLOCK',
];

// SSN0-273: ประวัติการระงับ/ยกเลิกระงับ — **เพิ่มแถวอย่างเดียว** เขียนคู่กับสถานะใน transaction เดียว
@Entity({ name: 'member_login_block_log' })
export class MemberLoginBlockLogEntity {
  @PrimaryGeneratedColumn()
  log_id: number;

  @Index('IDX_member_login_block_log_member')
  @Column({ length: 30 })
  mem_code: string;

  @Column({ type: 'enum', enum: MEMBER_LOGIN_BLOCK_ACTIONS })
  action: MemberLoginBlockAction;

  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  reason: string | null;

  // ผู้ทำรายการ — sale-backend อ่านจาก token ของพนักงาน ไม่ได้รับจาก browser
  @Column({ length: 50 })
  actor_emp_code: string;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  actor_name: string | null;

  @CreateDateColumn()
  created_at: Date;
}
