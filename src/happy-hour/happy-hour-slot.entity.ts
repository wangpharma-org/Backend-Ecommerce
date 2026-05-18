import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: '0582', database: 'e-commerce-database-other' })
export class HappyHourSlotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'time' })
  start_time!: string;

  @Column({ type: 'time' })
  end_time!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  min_order_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  card_value!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  excess_threshold!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discount_per_step!: number;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reward_pro_code!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  reward_unit!: string | null;

  @Column({ type: 'int', default: 1 })
  reward_amount!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
