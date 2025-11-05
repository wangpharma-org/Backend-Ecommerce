import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';

@Entity({ name: 'promotion_reward' })
export class PromotionRewardEntity {
  @PrimaryGeneratedColumn()
  reward_id: number;

  @Index()
  @ManyToOne(() => ProductEntity, (product) => product.promotionRewardsAsGift, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_gcode', referencedColumnName: 'pro_code' })
  giftProduct: ProductEntity;

  @Column({ type: 'int', default: 1 })
  qty: number;

  @Column({ length: 16, comment: 'หน่วยที่แถม' })
  unit: string;

  @Column({ type: 'int', nullable: true, default: null })
  free_product_limit: number;

  @Column({ type: 'int', nullable: true, default: 0 })
  free_product_count: number;

  @Index()
  @ManyToOne(() => PromotionTierEntity, (tier) => tier.rewards, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tier_id' })
  tier: PromotionTierEntity;
}
