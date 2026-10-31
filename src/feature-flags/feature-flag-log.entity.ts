import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/// ECWC-749: ประวัติการเปิด/ปิด feature flag (เพิ่มอย่างเดียว) — ใคร เปลี่ยน flag ไหน จากอะไรเป็นอะไร
/// แยกจาก admin_action_log เพราะตารางนั้นผูกกับ "บัญชีเป้าหมาย" และหน้าจัดการสิทธิ์อ่าน action_type แค่ 2 แบบ
@Entity('feature_flag_log')
export class FeatureFlagLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index('IDX_FEATURE_FLAG_LOG_KEY')
  @Column({ type: 'varchar', length: 255 })
  feature_key!: string;

  /// null = flag ยังไม่เคยมีมาก่อน (สร้างใหม่จากการตั้งค่าครั้งนี้)
  @Column({ type: 'boolean', nullable: true })
  old_value!: boolean | null;

  @Column({ type: 'boolean' })
  new_value!: boolean;

  @Column({ type: 'varchar', length: 50 })
  actor_mem_code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  actor_username!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  actor_role!: string | null;

  @Index('IDX_FEATURE_FLAG_LOG_CREATED')
  @CreateDateColumn()
  created_at!: Date;
}
