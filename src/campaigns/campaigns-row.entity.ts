import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { CampaignEntity } from './campaigns.entity';
import { PromoProductEntity } from './campaigns-product.entity';
import { CampaignsPromoRewardEntity } from './campaigns-promo-reward.entity';

@Entity({ name: 'campaigns_row' })
export class CampaignRowEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignEntity, { onDelete: 'CASCADE' })
  campaign: CampaignEntity;

  @Column({ type: 'int' })
  set_number: number;

  @Column({ type: 'text', nullable: true })
  condition?: string;

  @Column({ type: 'decimal', nullable: true })
  target?: string;

  @Column({ type: 'decimal', nullable: true })
  con_percent?: string;

  @Column({ type: 'decimal', nullable: true })
  calculated_value?: string;

  @Column({ type: 'decimal', nullable: true })
  price_per_set?: string;

  @Column({ type: 'int', nullable: true })
  number_of_sets?: number;

  @Column({ type: 'decimal', nullable: true })
  total_achieved?: string;

  @Column({ type: 'decimal', nullable: true })
  total_reward_value?: string;

  @Column({ type: 'decimal', nullable: true })
  usage_per_unit?: string;

  @Column({ type: 'decimal', nullable: true })
  unit_price?: string;

  @Column({ type: 'int', nullable: true })
  quantity?: number;

  @Column({ type: 'decimal', nullable: true })
  discounted_price?: string;

  @Column({ type: 'boolean', default: false })
  show_unit_price_columns: boolean;

  @Column({ type: 'boolean', default: false })
  show_discounted_price_column: boolean;

  @CreateDateColumn({ name: 'created_at' })
  created_at: Date;

  @OneToMany(() => CampaignsPromoRewardEntity, (reward) => reward.promo_row)
  promo_rewards: CampaignsPromoRewardEntity[];

  @OneToMany(() => PromoProductEntity, (promoProduct) => promoProduct.promo_row)
  promo_products: PromoProductEntity[];
}
