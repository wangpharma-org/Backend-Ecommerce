import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';
import { CampaignRowEntity } from './campaigns-row.entity';

@Entity({ name: 'campaigns_promo_products' })
@Unique(['promo_row', 'product'])
export class PromoProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @ManyToOne(() => CampaignRowEntity, (promoRow) => promoRow.promo_products, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'promo_row_id' })
  promo_row: CampaignRowEntity;

  @Index()
  @ManyToOne(
    () => ProductEntity,
    (product) => product /* adjust if relation added */,
    {
      onDelete: 'CASCADE',
    },
  )
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product: ProductEntity;
}
