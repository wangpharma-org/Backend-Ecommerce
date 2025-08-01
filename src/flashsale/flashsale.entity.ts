import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Entity({ name: 'flashsale' })
export class FlashSaleEntity {
  @PrimaryGeneratedColumn()
  spc_id: number;

  @ManyToOne(() => ProductEntity, (product) => product.flashsale)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
