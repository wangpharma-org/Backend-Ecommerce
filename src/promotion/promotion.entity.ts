import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { CreditorEntity } from '../products/creditor.entity';

@Entity({ name: 'promotion' })
export class PromotionEntity {
  @PrimaryGeneratedColumn()
  promo_id!: number;

  @ManyToOne(() => CreditorEntity, (creditor) => creditor.promotions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creditor_code', referencedColumnName: 'creditor_code' })
  creditor!: CreditorEntity;

  @Column({ length: 255 })
  promo_name!: string;

  @Column({ type: 'datetime' })
  start_date!: Date;

  @Column({ type: 'datetime' })
  end_date!: Date;

  @Column({ default: false })
  status!: boolean;

  @Column({ type: 'varchar', nullable: true, default: null, length: 500 })
  promo_poster!: string | null;

  @DeleteDateColumn({ nullable: true })
  deleted_at!: Date;

  @OneToMany(() => PromotionTierEntity, (tier) => tier.promotion)
  tiers!: PromotionTierEntity[];
}
