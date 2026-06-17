import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type QuestionnaireInputType = 'star' | 'text';

@Entity({ name: 'questionnaire_config' })
export class QuestionnaireConfigEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 500 })
  question!: string;

  @Column({ default: true })
  status!: boolean;

  @Column({
    type: 'enum',
    enum: ['star', 'text'],
    default: 'star',
  })
  input_type!: QuestionnaireInputType;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
