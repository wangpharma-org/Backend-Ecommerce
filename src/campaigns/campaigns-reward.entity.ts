import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';
import { CampaignEntity } from './campaigns.entity';
import { ProductEntity } from 'src/products/products.entity';

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

  @Column({ type: 'text', nullable: true, default: null })
  img_url: string;

  @ManyToOne(() => ProductEntity, { nullable: true })
  @JoinColumn({ name: 'linked_product_code', referencedColumnName: 'pro_code' })
  linked_product?: ProductEntity;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;
}
