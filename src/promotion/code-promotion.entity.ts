import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'code_promotion' })
export class CodePromotionEntity {
  @PrimaryGeneratedColumn()
  code_id: number;

  @Column({ length: 50, unique: true })
  code_text: string;

  @Column({ length: 15 })
  mem_code: string;
}
