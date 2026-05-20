import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('review_request')
export class ReviewRequestEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  mem_code: string;

  @Column({ type: 'json' })
  sh_running: string[];

  @Index()
  @Column({ default: false })
  is_completed: boolean;

  @CreateDateColumn()
  created_at: Date;
}
