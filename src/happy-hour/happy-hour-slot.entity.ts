import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { HappyHourSlotRewardEntity } from './happy-hour-slot-reward.entity';
import { HappyHourSlotMinProductEntity } from './happy-hour-slot-min-product.entity';

export type RewardType = 'card' | 'bill_discount';
export type MinOrderScope = 'all' | 'specific' | 'vendor';

@Entity({ name: 'happy_hour_slot' })
export class HappyHourSlotEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'time' })
  start_time!: string;

  @Column({ type: 'time' })
  end_time!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  min_order_amount!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  card_value!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  excess_threshold!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discount_per_step!: number;

  @Column({ default: true })
  is_active!: boolean;

  @Column({ type: 'varchar', length: 20, nullable: true })
  reward_pro_code!: string | null;

  @Column({
    type: 'enum',
    enum: ['1', '2', '3'],
    nullable: true,
    default: null,
  })
  reward_unit_enum!: '1' | '2' | '3' | null;

  @Column({ type: 'int', default: 1 })
  reward_amount!: number;

  @Column({
    type: 'enum',
    enum: ['card', 'bill_discount'],
    default: 'card',
  })
  reward_type!: RewardType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  reward_value!: number;

  @Column({
    type: 'enum',
    enum: ['all', 'specific', 'vendor'],
    default: 'all',
  })
  min_order_scope!: MinOrderScope;

  @Column({ type: 'varchar', length: 50, nullable: true, default: null })
  min_order_vendor_code!: string | null;

  @OneToMany(() => HappyHourSlotRewardEntity, (r) => r.slot, {
    eager: true,
    cascade: ['insert', 'update'],
  })
  rewards!: HappyHourSlotRewardEntity[];

  @OneToMany(() => HappyHourSlotMinProductEntity, (p) => p.slot, {
    eager: true,
    cascade: ['insert', 'update'],
  })
  minOrderProducts!: HappyHourSlotMinProductEntity[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
