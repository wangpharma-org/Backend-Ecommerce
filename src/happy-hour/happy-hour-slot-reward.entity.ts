import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';

@Entity({ name: 'happy_hour_slot_reward' })
export class HappyHourSlotRewardEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  pro_code!: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  unit!: string | null;

  @ManyToOne(() => HappyHourSlotEntity, (slot) => slot.rewards, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'slot_id' })
  slot!: HappyHourSlotEntity;
}
