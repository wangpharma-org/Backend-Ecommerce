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

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_qty: number;

  @Column({ length: 20, nullable: true })
  spo_unit: string;

  // @Column({ name: 'soh_running', length: 20, nullable: true })
  // soh_running: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_price_unit: number;

  // @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  // spo_ppu: number;

  @Column({ length: 20, nullable: true })
  pro_code: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, nullable: true })
  spo_total_decimal: number;

  @ManyToOne(() => ShoppingHeadEntity, (header) => header.details)
  @JoinColumn({ name: 'soh_running', referencedColumnName: 'soh_running' })
  orderHeader: ShoppingHeadEntity;

  @ManyToOne(() => ProductEntity, (product) => product.inOrders)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
