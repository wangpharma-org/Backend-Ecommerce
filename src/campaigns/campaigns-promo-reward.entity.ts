import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
  OneToMany,
} from 'typeorm';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignRewardEntity } from './campaigns-reward.entity';

@Entity({ name: 'campaigns_promo_rewards' })
@Unique(['promo_row', 'reward_column'])
export class CampaignsPromoRewardEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignRowEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promo_row_id' })
  promo_row: CampaignRowEntity;

  @Index()
  @ManyToOne(() => CampaignRewardEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reward_column_id' })
  reward_column: CampaignRewardEntity;

  @Column({ type: 'decimal', nullable: true })
  quantity?: string;

  @Column({ type: 'text', nullable: true })
  unit?: string;

  @Column({ type: 'decimal', nullable: true })
  price?: string;

  @Column({ type: 'decimal', nullable: true })
  value?: string;

  @OneToMany(() => CampaignsPromoRewardEntity, (r) => r.reward_column)
  promo_rewards: CampaignsPromoRewardEntity[];
}
