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
// ชื่อ index/FK ตรงกับ migration 20260921000100 — ไม่งั้น migration:generate จะ DROP/สร้างใหม่
@Index('IDX_promotion_tier_exclusion_tier_product', ['tier_id', 'product_code'], {
  unique: true,
})
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
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'tier_id',
    foreignKeyConstraintName: 'FK_promotion_tier_exclusion_tier',
  })
  tier!: PromotionTierEntity;

  @Index('IDX_promotion_tier_exclusion_product')
  @ManyToOne(() => ProductEntity, {
    nullable: false,
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'product_code',
    referencedColumnName: 'pro_code',
    foreignKeyConstraintName: 'FK_promotion_tier_exclusion_product',
  })
  product!: ProductEntity;
}
