import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'dhl_tracking' })
@Unique('UQ_dhl_tracking_order_number', ['soh_running', 'tracking_number'])
@Index('IDX_dhl_tracking_soh_running', ['soh_running'])
export class DhlTrackingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 60 })
  soh_running!: string;

  @Column({ length: 120 })
  tracking_number!: string;

  @CreateDateColumn({ type: 'datetime', precision: 6 })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime', precision: 6 })
  updated_at!: Date;
}
