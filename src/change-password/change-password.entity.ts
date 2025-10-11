import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';

@Entity('change_password')
export class ChangePassword {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 6 })
  otp: string; // รหัส OTP 6 หลัก

  @Column({ length: 50 })
  exp_code: string; // เช่น 'reset_password', 'change_email' ฯลฯ


  @Column({ type: 'int', default: 0 })
  countError: number;

  @Column({ type: 'enum', enum: ['pending', 'used', 'failed', 'requested'], default: 'pending' })
  isUsed: 'pending' | 'used' | 'failed' | 'requested';

  @ManyToOne(() => UserEntity, (user) => user.changePasswords) // สมมติว่ามี Entity ชื่อ User
  @JoinColumn({ name: 'mem_username' })
  user: UserEntity;
}
