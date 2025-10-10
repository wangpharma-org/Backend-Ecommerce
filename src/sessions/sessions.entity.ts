import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';

@Entity({ name: 'user-sessions' })
export class UserSessionsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  mem_code: string;

  @Column({ type: 'varchar', length: 1024 })
  session_token: string;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string;

  @Column({ type: 'text', nullable: true })
  user_agent: string;

  @Column({ type: 'varchar', length: 256, nullable: true })
  device_type: string;

  @Column({ type: 'timestamp' })
  login_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  last_activity: Date;

  @Column({ type: 'timestamp', nullable: true })
  logout_at: Date;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;
}
