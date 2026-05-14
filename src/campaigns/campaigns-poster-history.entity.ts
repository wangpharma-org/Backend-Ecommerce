import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CampaignRowEntity } from './campaigns-row.entity';
import { CampaignPosterBannerLinkEntity } from './campaigns-poster-banner-link.entity';

@Entity({ name: 'campaigns_poster_history' })
export class CampaignPosterHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignRowEntity, { onDelete: 'CASCADE' })
  row: CampaignRowEntity;

  @Column({ type: 'text' })
  img_url: string;

  @OneToMany(() => CampaignPosterBannerLinkEntity, (link) => link.history, { cascade: true })
  banner_links: CampaignPosterBannerLinkEntity[];

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
