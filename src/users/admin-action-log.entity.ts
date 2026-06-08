import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('admin_action_log')
export class AdminActionLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  admin_mem_code: string;

  @Column()
  admin_username: string;

  @Index()
  @Column()
  target_mem_code: string;

  @Column()
  target_username: string;

  @Column({ length: 50 })
  action_type: 'role_change' | 'feature_change';

  @Column({ type: 'text', nullable: true })
  old_value: string | null;

  @Column({ type: 'text', nullable: true })
  new_value: string | null;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
