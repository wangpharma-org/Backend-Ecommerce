import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ProductEntity } from './products.entity';
import { PromotionEntity } from '../promotion/promotion.entity';

@Entity({ name: 'creditor' })
export class CreditorEntity {
  @PrimaryGeneratedColumn()
  creditor_id: number;

  @Column({ unique: true })
  creditor_code: string;

  @Column()
  creditor_name: string;

  @OneToMany(() => ProductEntity, (product) => product)
  @JoinColumn({ name: 'creditor_code' })
  product: ProductEntity;

  @OneToMany(() => PromotionEntity, (promotion) => promotion.creditor)
  promotions: PromotionEntity[];
}
