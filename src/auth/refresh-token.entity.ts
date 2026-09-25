import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';

@Entity({ name: 'reflesh-token' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 512 })
  refresh_token: string;

  @Column()
  mem_code: string;

  // nullable เพราะข้อมูลเดิมก่อน ECWC-631 ไม่มีค่านี้ — cron cleanup จะข้าม record ที่เป็น null
  @CreateDateColumn({ type: 'timestamp', nullable: true })
  created_at: Date | null;
}
