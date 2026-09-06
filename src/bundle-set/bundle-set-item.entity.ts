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
@Index(['set_code', 'sort_order'])
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
  @JoinColumn({ name: 'set_code' })
  set!: BundleSetEntity;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product!: ProductEntity;
}
