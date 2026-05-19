import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'happy_hour_config', database: 'e-commerce-database-other' })
export class HappyHourConfigEntity {
  @PrimaryColumn({ type: 'int' })
  id!: number;

  @Column({ default: false })
  is_enabled!: boolean;

  @Column({ type: 'datetime', nullable: true })
  updated_at!: Date | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  updated_by!: string | null;
}
