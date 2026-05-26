import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ConfigLogAction = 'UPDATE' | 'TOGGLE';

@Entity({
  name: 'happy_hour_config_log',
})
export class HappyHourConfigLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** UPDATE (แก้ config ตรงๆ) | TOGGLE (กด on/off) */
  @Column({ type: 'varchar', length: 10 })
  action!: ConfigLogAction;

  @Column({ type: 'varchar', length: 100 })
  performed_by!: string;

  /**
   * Snapshot ของค่าก่อน/หลังเปลี่ยน (JSON string)
   * { before: {...}, after: {...} }
   */
  @Column({ type: 'text', nullable: true })
  changes!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
