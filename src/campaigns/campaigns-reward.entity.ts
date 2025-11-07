import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CampaignEntity } from './campaigns.entity';

@Entity({ name: 'campaigns_reward' })
export class CampaignRewardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  campaign: CampaignEntity;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  unit?: string;

  @Column({ type: 'decimal', nullable: true })
  value_per_unit?: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
