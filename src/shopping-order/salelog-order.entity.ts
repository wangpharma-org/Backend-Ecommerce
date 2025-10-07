import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'sale_log' })
export class SaleLogEntity {
  @PrimaryGeneratedColumn()
  log_id: number;

  @Column({ type: 'varchar' })
  sh_running: string;

  @Column({ type: 'varchar' })
  emp_code: string;

  @Column({ type: 'varchar' })
  ip_address: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_total_decimal: number;

  @Column({ type: 'varchar' })
  mem_code: string;

  @Column({ type: 'datetime' })
  log_date: Date;
}
