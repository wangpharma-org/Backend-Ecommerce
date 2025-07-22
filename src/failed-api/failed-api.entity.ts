import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'failed-api' })
export class FailedEntity {
  @PrimaryGeneratedColumn()
  failed_id: number;

  @Column({ type: 'json' })
  failed_json: JSON;
}
