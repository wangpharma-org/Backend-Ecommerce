import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  Relation,
  UpdateDateColumn,
} from 'typeorm';
import { ImageReviewEntity } from './image-review.entity';
import { QuestionnaireEntity } from './questionnaire.entity';

@Entity({ name: 'rating' })
export class RatingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 50 })
  sh_running!: string;

  @Column({ type: 'decimal', precision: 2, scale: 1 })
  rating_point!: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;

  @Column({ type: 'simple-json', nullable: true })
  positive_select?: string[];

  @Column({ type: 'simple-json', nullable: true })
  negative_select?: string[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => ImageReviewEntity, (img: ImageReviewEntity) => img.rating, {
    cascade: true,
  })
  images?: Relation<ImageReviewEntity[]>;

  @OneToMany(() => QuestionnaireEntity, (q: QuestionnaireEntity) => q.rating, {
    cascade: true,
  })
  questionnaires?: Relation<QuestionnaireEntity[]>;
}
