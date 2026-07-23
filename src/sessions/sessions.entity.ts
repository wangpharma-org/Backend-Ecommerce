import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';

@Entity({ name: 'user-sessions' })
@Index('idx_user_sessions_mem_active', ['mem_code', 'is_active'])
export class UserSessionsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 30 })
  mem_code: string;

  @Column({ type: 'varchar', length: 1024 })
  session_token: string;

  // SHA-256 ของ session_token — ใช้เป็นเงื่อนไขค้นหาแทน session_token ที่ยาวเกินจะทำ index ได้
  @Index('idx_user_sessions_token_hash')
  @Column({ type: 'varchar', length: 64, nullable: true })
  token_hash: string | null;

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
