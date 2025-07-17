import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity({ name: 'shopping_order' })
export class ShoppingOrderEntity {
  @PrimaryGeneratedColumn()
  spo_id: number;

  @Column({ length: 11, nullable: true })
  spo_runing: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spo_qty: number;

  @Column({ length: 20 })
  spo_unit: string;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spo_price_unit: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spo_ppu: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spo_total_decimal: number;

  @ManyToOne(() => ShoppingHeadEntity, (header) => header.details)
  @JoinColumn({ name: 'shopping_order_hd_id' })
  orderHeader: ShoppingHeadEntity;

  @ManyToOne(() => ProductEntity, (product) => product.inOrders)
  @JoinColumn({ name: 'pro_id' })
  product: ProductEntity;
}
