import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';

@Entity({ name: 'happy_hour_slot_min_products' })
export class HappyHourSlotMinProductEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 20 })
  pro_code!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  pro_name!: string | null;

  @ManyToOne(() => HappyHourSlotEntity, (slot) => slot.minOrderProducts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'slot_id' })
  slot!: HappyHourSlotEntity;
}
