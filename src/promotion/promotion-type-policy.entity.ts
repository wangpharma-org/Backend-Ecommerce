import { Column, Entity, PrimaryColumn } from 'typeorm';

export type PromotionType = 'company' | 'wang';

@Entity({ name: 'promotion_type_policy' })
export class PromotionTypePolicyEntity {
  @PrimaryColumn({ type: 'tinyint', unsigned: true })
  id!: number;

  @Column({ type: 'varchar', length: 10, nullable: true, default: null })
  locked_type!: PromotionType | null;

  @Column({ type: 'int', unsigned: true, nullable: true, default: null })
  locked_promo_id!: number | null;

  @Column({ type: 'datetime', nullable: true, default: null })
  locked_at!: Date | null;
}
