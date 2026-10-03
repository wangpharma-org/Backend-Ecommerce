import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'promotion_date_change_log' })
@Index('IDX_promo_date_log_promo_created_at', ['promo_id', 'created_at'])
export class PromotionDateChangeLogEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  promo_id!: number;

  @Column({ type: 'varchar', length: 100 })
  admin_mem_code!: string;

  @Column({ type: 'varchar', length: 255 })
  admin_username!: string;

  @Column({ type: 'datetime' })
  old_start_date!: Date;

  @Column({ type: 'datetime' })
  old_end_date!: Date;

  @Column({ type: 'datetime' })
  new_start_date!: Date;

  @Column({ type: 'datetime' })
  new_end_date!: Date;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;
}
