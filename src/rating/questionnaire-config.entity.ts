import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'questionnaire_config' })
export class QuestionnaireConfigEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 500 })
  question!: string;

  @Column({ default: true })
  status!: boolean;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
