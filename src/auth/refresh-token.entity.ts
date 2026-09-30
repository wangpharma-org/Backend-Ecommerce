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
  // default ต้องมีใน DB ด้วย เพราะ TypeORM INSERT ค่านี้เป็น `DEFAULT` ไม่ได้ส่งเวลาไปเอง
  // precision: null — CreateDateColumn ใส่ precision 6 ให้เอง ทำให้ timestamp(6) DEFAULT CURRENT_TIMESTAMP
  // ผิด (ER_INVALID_DEFAULT) และไม่ตรงกับ migration ที่เป็น timestamp ไม่มี precision
  @CreateDateColumn({
    type: 'timestamp',
    precision: null,
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date | null;
}
