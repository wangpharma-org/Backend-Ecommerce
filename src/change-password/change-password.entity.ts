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

  @CreateDateColumn({ type: 'timestamp' })
  useAt: Date;

  @ManyToOne(() => UserEntity, (user) => user.changePasswords) // สมมติว่ามี Entity ชื่อ User
  @JoinColumn({ name: 'mem_username' })
  user: UserEntity;
}
