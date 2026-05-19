import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('watermark_audit')
export class WatermarkAuditEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 32 })
  token: string;

  @Index()
  @Column()
  mem_code: string;

  @Column({ length: 255 })
  page: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip: string | null;

  @Column({ type: 'varchar', length: 512, nullable: true })
  user_agent: string | null;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
