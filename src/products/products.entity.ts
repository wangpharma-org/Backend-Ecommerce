import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';

@Entity({ name: 'product' })
export class ProductEntity {
  @PrimaryGeneratedColumn()
  pro_id: number;

  @Column({ unique: true, length: 20 })
  pro_code: string;

  @Column({ length: 255, nullable: true })
  pro_name: string;

  @Column({ length: 255, nullable: true })
  pro_nameEN: string;

  @Column({ length: 255, nullable: true })
  pro_nameSale: string;

  @Column({ length: 255, nullable: true })
  pro_namePacking: string;

  @Column({ length: 255, nullable: true })
  pro_genericname: string;

  @Column('json')
  pro_keysearch: string[];

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceA: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceB: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceC: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_cost: number;

  @Column({ length: 30, nullable: true })
  pro_supplier: string;

  @Column({ length: 60, nullable: true })
  pro_barcode1: string;

  @Column({ length: 60, nullable: true })
  pro_barcode2: string;

  @Column({ length: 60, nullable: true })
  pro_barcode3: string;

  @Column({ length: 255, nullable: true })
  pro_imgmain: string;

  @Column({ nullable: true })
  pro_ratio1: number;

  @Column({ nullable: true })
  pro_ratio2: number;

  @Column({ nullable: true })
  pro_ratio3: number;

  @Column({ length: 30, nullable: true })
  pro_unit1: string;

  @Column({ length: 30, nullable: true })
  pro_unit2: string;

  @Column({ length: 30, nullable: true })
  pro_unit3: string;

  @Column({ type: 'enum', enum: ['Y', 'N'], default: 'N' })
  pro_isdrug: 'Y' | 'N';

  @Column({ type: 'enum', enum: ['Y', 'N'], default: 'Y' })
  pro_isvat: 'Y' | 'N';

  @Column({ type: 'enum', enum: ['Y', 'N'], default: 'N' })
  pro_ishot: 'Y' | 'N';

  @Column({ length: 120, nullable: true })
  pro_drugregister: string;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  pro_utility: number;

  @OneToOne(() => ProductPharmaEntity, (pharma) => pharma.product)
  pharmaDetails: ProductPharmaEntity;

  @OneToMany(() => ShoppingCartEntity, (cart) => cart.product)
  inCarts: ShoppingCartEntity[];

  @OneToMany(() => ShoppingOrderEntity, (orderDetail) => orderDetail.product)
  inOrders: ShoppingOrderEntity[];
}
