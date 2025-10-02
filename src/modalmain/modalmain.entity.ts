import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
@Entity('modalmain')
export class Modalmain {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255, collation: 'utf8mb4_0900_ai_ci' })
  title: string;

  @Column({
    type: 'longtext',
    collation: 'utf8mb4_0900_ai_ci',
    nullable: true,
    default: null,
  })
  content: string;

  @Column({ nullable: true, default: null })
  imageUrl: string;

  @Column({ default: true })
  show: boolean;
}
