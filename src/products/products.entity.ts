import { Entity, PrimaryColumn, Column, OneToOne, OneToMany } from 'typeorm';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { ShoppingOrderEntity } from '../shopping-order/shopping-order.entity';
import { FavoriteEntity } from '../favorite/favorite.entity';
import { FlashSaleEntity } from '../flashsale/flashsale.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';

@Entity({ name: 'product' })
export class ProductEntity {
  @PrimaryColumn({ unique: true, length: 20 })
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

  @Column({ nullable: true, length: 10000 })
  pro_keysearch: string;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceA: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceB: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_priceC: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  pro_cost: number;

  @Column({ length: 100, nullable: true })
  pro_supplier: string;

  @Column({ length: 60, nullable: true })
  pro_barcode1: string;

  @Column({ length: 60, nullable: true })
  pro_barcode2: string;

  @Column({ length: 60, nullable: true })
  pro_barcode3: string;

  @Column({ length: 255, nullable: true })
  pro_imgmain: string;

  @Column({ length: 255, nullable: true })
  pro_img2: string;

  @Column({ length: 255, nullable: true })
  pro_img3: string;

  @Column({ length: 255, nullable: true })
  pro_img4: string;

  @Column({ length: 255, nullable: true })
  pro_img5: string;

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

  @Column({ nullable: true })
  pro_point: number;

  @Column({ default: false })
  pro_free: boolean;

  @Column({ length: 120, nullable: true })
  pro_drugregister: string;

  @Column({ default: 0 })
  pro_stock: number;

  @Column({ type: 'decimal', precision: 6, scale: 1, nullable: true })
  pro_utility: number;

  @Column({ nullable: true })
  pro_category: number;

  @Column({ nullable: true, type: 'tinyint' })
  pro_promotion_month: number | null;

  @Column({ nullable: true, default: 1, type: 'smallint' })
  pro_promotion_amount: number | null;

  @Column({ default: false })
  is_detect_amount: boolean;

  @OneToOne(() => ProductPharmaEntity, (pharma) => pharma.product)
  pharmaDetails: ProductPharmaEntity;

  @OneToMany(() => ShoppingCartEntity, (cart) => cart.product)
  inCarts: ShoppingCartEntity[];

  @OneToMany(() => FlashSaleEntity, (cart) => cart.product)
  flashsale: FlashSaleEntity[];

  @OneToMany(() => FavoriteEntity, (favorite) => favorite.product)
  inFavorite: FavoriteEntity[];

  @OneToMany(() => ShoppingOrderEntity, (orderDetail) => orderDetail.product)
  inOrders: ShoppingOrderEntity[];

  @OneToMany(() => HotdealEntity, (hotdeal) => hotdeal.product)
  inHotdeals: HotdealEntity[];
}
