import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';

@Entity('notification_tokens')
@Index(['mem_code'], { unique: true }) // Ensure one token per member
export class NotificationTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 30 })
  mem_code: string;

  @Column({ length: 500, nullable: false })
  token: string;

  @Column({ type: 'varchar', length: 50, default: 'fcm', nullable: true })
  token_type: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;
}
