import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BundleSetEntity } from './bundle-set.entity';
import { ProductEntity } from '../products/products.entity';

/** สินค้าหนึ่งบรรทัดในกระเช้า — is_gift แยกของแถมออกจากสินค้าหลัก */
@Entity({ name: 'bundle_set_item' })
// ตั้งชื่อ index/FK ให้ตรงกับที่ migration release-1.48.0 สร้างไว้ ไม่งั้น migration:generate จะ drop แล้วสร้างใหม่
@Index('IDX_bundle_set_item_order', ['set_code', 'sort_order'])
@Index('IDX_bundle_set_item_product', ['pro_code'])
export class BundleSetItemEntity {
  @PrimaryGeneratedColumn()
  item_id!: number;

  @Column({ length: 30 })
  set_code!: string;

  @Column({ length: 20 })
  pro_code!: string;

  /** อ้าง product_unit.level (1 = หน่วยเล็กสุด) */
  @Column({ type: 'int', default: 1 })
  unit_level!: number;

  @Column({ type: 'int' })
  qty!: number;

  /** true = ของแถมในชุด คิดราคา 0 แต่ยังตัดสต็อก */
  @Column({ default: false })
  is_gift!: boolean;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @ManyToOne(() => BundleSetEntity, (set) => set.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'set_code',
    foreignKeyConstraintName: 'FK_bundle_set_item_set',
  })
  set!: BundleSetEntity;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({
    name: 'pro_code',
    referencedColumnName: 'pro_code',
    foreignKeyConstraintName: 'FK_bundle_set_item_product',
  })
  product!: ProductEntity;
}
