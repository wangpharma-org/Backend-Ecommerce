import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { CreditorEntity } from '../products/creditor.entity';

@Entity({ name: 'promotion' })
export class PromotionEntity {
  @PrimaryGeneratedColumn()
  promo_id: number;

  @ManyToOne(() => CreditorEntity, (creditor) => creditor.promotions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creditor_code', referencedColumnName: 'creditor_code' })
  creditor: CreditorEntity;

  @Column({ length: 255 })
  promo_name: string;

  @Column()
  start_date: Date;

  @Column()
  end_date: Date;

  @Column({ default: false })
  status: boolean;

  @OneToMany(() => PromotionTierEntity, (tier) => tier.promotion)
  tiers: PromotionTierEntity[];
}
