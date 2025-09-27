import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  Column,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { FlashSaleEntity } from './flashsale.entity';

@Entity({ name: 'flashsale_products' })
export class FlashSaleProductsEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: null, type: 'int' })
  limit: number | null;

  @ManyToOne(() => FlashSaleEntity, (flashSale) => flashSale.flashsaleProducts)
  @JoinColumn({ name: 'promotion_id' })
  flashsale: FlashSaleEntity;

  @ManyToOne(() => ProductEntity, (product) => product.flashsale)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
