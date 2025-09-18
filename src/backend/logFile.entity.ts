import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class LogFileEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  filename: string;

  @Column()
  feature: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  uploadedAt: Date;
}
