import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';

@Entity({ name: 'promotion_condition' })
export class PromotionConditionEntity {
  @PrimaryGeneratedColumn()
  cond_id: number;

  @Index()
  @ManyToOne(() => ProductEntity, (product) => product.promotionConditions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'product_code', referencedColumnName: 'pro_code' })
  product: ProductEntity;

  @Index()
  @ManyToOne(() => PromotionTierEntity, (tier) => tier.conditions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tier_id' })
  tier: PromotionTierEntity;
}
