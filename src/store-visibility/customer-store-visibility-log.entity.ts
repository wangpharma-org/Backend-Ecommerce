import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// GRANTED = กดเปิด · DECLINED = กดปิดตอนที่ยังไม่เคยเปิด · WITHDRAWN = เคยเปิดแล้วมากดปิด
// ASKED = เอาการ์ดขอความยินยอมไปแสดงแล้วลูกค้าไม่ตอบ (ปัดทิ้ง)
export type StoreVisibilityLogAction =
  | 'GRANTED'
  | 'DECLINED'
  | 'WITHDRAWN'
  | 'ASKED';

export const STORE_VISIBILITY_LOG_ACTIONS: StoreVisibilityLogAction[] = [
  'GRANTED',
  'DECLINED',
  'WITHDRAWN',
  'ASKED',
];

export type StoreVisibilityChannel = 'WEB' | 'APP';

export const STORE_VISIBILITY_CHANNELS: StoreVisibilityChannel[] = [
  'WEB',
  'APP',
];

// ECWC-600 (PDPA): หลักฐานความยินยอม — **เพิ่มแถวอย่างเดียว** ไม่มี update/delete
// เขียนคู่กับสถานะใน customer_store_visibility ใน transaction เดียว ไม่ให้สถานะเปลี่ยนแบบไม่มี log
@Entity({ name: 'customer_store_visibility_log' })
export class CustomerStoreVisibilityLogEntity {
  @PrimaryGeneratedColumn()
  log_id: number;

  @Index('IDX_store_visibility_log_member')
  @Column({ length: 50 })
  mem_code: string;

  @Column({ type: 'enum', enum: STORE_VISIBILITY_LOG_ACTIONS })
  action: StoreVisibilityLogAction;

  @Column({ type: 'int' })
  consent_version: number;

  // sha256 ของข้อความที่ลูกค้าเห็นตอนนั้น (ดู consentTextHash)
  @Column({ length: 64 })
  text_hash: string;

  @Column({ type: 'enum', enum: STORE_VISIBILITY_CHANNELS })
  channel: StoreVisibilityChannel;

  // ต้องระบุ type ตรง ๆ เพราะชนิดที่ประกาศเป็น union (string | null) ทำให้ TypeScript ส่ง
  // design:type ออกมาเป็น Object แล้ว TypeORM เดา column type ไม่ได้
  @Column({ type: 'varchar', length: 45, nullable: true, default: null })
  ip: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, default: null })
  user_agent: string | null;

  @CreateDateColumn()
  created_at: Date;
}
