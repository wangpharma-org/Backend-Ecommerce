import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { RatingEntity } from './rating.entity';
import { QuestionnaireConfigEntity } from './questionnaire-config.entity';

@Entity({ name: 'questionnaire' })
export class QuestionnaireEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  rating_point!: number;

  @Column({ type: 'text', nullable: true, default: null })
  text_answer!: string | null;

  @Column()
  rating_id!: number;

  @Column()
  question_id!: number;

  @ManyToOne(() => RatingEntity, (rating) => rating.questionnaires, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rating_id' })
  rating?: Relation<RatingEntity>;

  @ManyToOne(() => QuestionnaireConfigEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question?: Relation<QuestionnaireConfigEntity>;
}
