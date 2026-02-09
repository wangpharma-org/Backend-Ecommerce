import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ProductReturnEntity } from './product-return.entity';
import { ProductEntity } from '../products/products.entity';

@Entity('product_return_items')
export class ProductReturnItemEntity {
  @PrimaryGeneratedColumn()
  return_item_id: number;

  @Index()
  @ManyToOne(() => ProductReturnEntity, (ret) => ret.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'return_id' })
  returnRequest: ProductReturnEntity;

  @Column()
  return_id: number;

  @Index()
  @ManyToOne(() => ProductEntity, { nullable: false })
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product: ProductEntity;

  @Column({ type: 'varchar', length: 20 })
  pro_code: string;

  @Column({ type: 'int' })
  qty: number;

  @Column({ type: 'varchar', length: 20 })
  unit: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  price_per_unit: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  total_price: number;

  @Column({ type: 'text', nullable: true })
  item_reason: string;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date | null;
}
