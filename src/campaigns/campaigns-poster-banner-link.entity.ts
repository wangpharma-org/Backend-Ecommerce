import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { CampaignPosterHistoryEntity } from './campaigns-poster-history.entity';

@Entity({ name: 'campaigns_poster_banner_link' })
export class CampaignPosterBannerLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignPosterHistoryEntity, (h) => h.banner_links, {
    onDelete: 'CASCADE',
  })
  history: CampaignPosterHistoryEntity;

  @Column({ type: 'int' })
  banner_id: number;

  @Column({ type: 'varchar', length: 50 })
  banner_location: string;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
