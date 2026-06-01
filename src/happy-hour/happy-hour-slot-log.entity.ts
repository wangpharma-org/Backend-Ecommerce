import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type SlotLogAction = 'CREATE' | 'UPDATE' | 'DELETE';

@Entity({
  name: 'happy_hour_slot_log',
})
export class HappyHourSlotLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  /** CREATE | UPDATE | DELETE */
  @Column({ type: 'varchar', length: 10 })
  action!: SlotLogAction;

  @Column({ type: 'int' })
  slot_id!: number;

  @Column({ type: 'varchar', length: 100 })
  performed_by!: string;

  /**
   * Snapshot ของ payload ที่ส่งมา (JSON string)
   * — CREATE: dto ทั้งหมด
   * — UPDATE: เฉพาะ field ที่เปลี่ยน (dto)
   * — DELETE: { slot_id }
   */
  @Column({ type: 'text', nullable: true })
  changes!: string | null;

  @CreateDateColumn()
  created_at!: Date;
}
