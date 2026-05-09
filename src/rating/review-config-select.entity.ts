import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ReviewSelectType = 'positive' | 'negative';

@Entity({ name: 'review_config_select' })
export class ReviewConfigSelectEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 255 })
  choice!: string;

  @Column({ type: 'enum', enum: ['positive', 'negative'] })
  type!: ReviewSelectType;

  @Column({ default: true })
  status!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
