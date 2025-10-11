import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProductEntity } from './products.entity';
import { PromotionEntity } from '../promotion/promotion.entity';
import { InvisibleEntity } from 'src/invisible-product/invisible-product.entity';

@Entity({ name: 'creditor' })
export class CreditorEntity {
  @PrimaryGeneratedColumn()
  creditor_id: number;

  @Column({ unique: true })
  creditor_code: string;

  @Column()
  creditor_name: string;

  @OneToMany(() => ProductEntity, (product) => product)
  product: ProductEntity;

  @OneToMany(() => PromotionEntity, (promotion) => promotion.creditor)
  promotions: PromotionEntity[];

  @OneToMany(() => InvisibleEntity, (invisible) => invisible.creditor)
  invisibleCreditor: InvisibleEntity[];
}
