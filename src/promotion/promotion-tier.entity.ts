import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { PromotionEntity } from './promotion.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';

@Entity({ name: 'promotion_tier' })
export class PromotionTierEntity {
  @PrimaryGeneratedColumn()
  tier_id: number;

  @Column({ length: 120 })
  tier_name: string;

  @Column({ length: 255, nullable: true })
  tier_postter: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  min_amount: number;

  @Column({ length: 255, nullable: true })
  description?: string;

  @Column({ length: 2000, nullable: true })
  detail?: string;

  @Column({ default: false })
  all_products: boolean;

  @OneToMany(() => PromotionConditionEntity, (cond) => cond.tier, {
    cascade: true,
  })
  conditions: PromotionConditionEntity[];

  @OneToMany(() => PromotionRewardEntity, (reward) => reward.tier, {
    cascade: true,
  })
  rewards: PromotionRewardEntity[];

  @Index()
  @ManyToOne(() => PromotionEntity, (promotion) => promotion.tiers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promo_id' })
  promotion: PromotionEntity;
}
