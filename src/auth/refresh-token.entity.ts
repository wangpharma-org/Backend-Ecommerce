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
  // precision: null — กัน @CreateDateColumn เติม (6) เอง ให้ตรงกับ migration (timestamp ธรรมดา)
  // ไม่งั้น timestamp(6) + DEFAULT CURRENT_TIMESTAMP จะ error "Invalid default value"
  @CreateDateColumn({
    type: 'timestamp',
    precision: null,
    nullable: true,
    default: () => 'CURRENT_TIMESTAMP',
  })
  created_at: Date | null;
}
