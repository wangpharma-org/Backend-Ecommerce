import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';

// สินค้าที่ไม่เข้าร่วม เฉพาะ tier ที่เป็น all_products
@Entity({ name: 'promotion_tier_exclusion' })
@Index(['tier_id', 'product_code'], { unique: true })
export class PromotionTierExclusionEntity {
  @PrimaryGeneratedColumn()
  exclusion_id!: number;

  @Column()
  tier_id!: number;

  @Column({ length: 20 })
  product_code!: string;

  @ManyToOne(() => PromotionTierEntity, (tier) => tier.exclusions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tier_id' })
  tier!: PromotionTierEntity;

  @Index()
  @ManyToOne(() => ProductEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_code', referencedColumnName: 'pro_code' })
  product!: ProductEntity;
}
