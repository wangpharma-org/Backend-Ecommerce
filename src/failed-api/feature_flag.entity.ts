import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'feature_flag' })
export class FeatureFlagEntity {
  @PrimaryGeneratedColumn()
  feature_id: number;

  @Column({ default: 'consume_service' })
  feature_key: string;

  @Column({ type: 'boolean', default: true })
  is_enabled: boolean;
}
