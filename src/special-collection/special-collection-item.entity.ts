import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { SpecialCollectionEntity } from './special-collection.entity';

/**
 * ชนิดของสิ่งที่หยิบมาใส่หน้าชุดสินค้าพิเศษ
 * - promotion   → ทั้งโปร (ทุก tier)
 * - tier        → เฉพาะบางขั้นของโปร
 * - product     → สินค้าเดี่ยว (ref_id = pro_code)
 * - hotdeal     → ดีลซื้อ X แถม Y
 * - flashsale   → แฟลชเซล
 * - bundle_set  → กระเช้า/ชุดสำเร็จ (เพิ่มใน Phase 4)
 */
export type SpecialCollectionRefType =
  | 'promotion'
  | 'tier'
  | 'product'
  | 'hotdeal'
  | 'flashsale'
  | 'bundle_set';

export const SPECIAL_COLLECTION_REF_TYPES: SpecialCollectionRefType[] = [
  'promotion',
  'tier',
  'product',
  'hotdeal',
  'flashsale',
  'bundle_set',
];

@Entity({ name: 'special_collection_item' })
// ตั้งชื่อ index/FK ให้ตรงกับที่ migration release-1.48.0 สร้างไว้ ไม่งั้น migration:generate จะ drop แล้วสร้างใหม่
@Index('IDX_special_collection_item_order', ['collection_id', 'sort_order'])
@Index('IDX_special_collection_item_ref', ['ref_type', 'ref_id'])
export class SpecialCollectionItemEntity {
  @PrimaryGeneratedColumn()
  item_id!: number;

  @Column({ type: 'int' })
  collection_id!: number;

  @Column({ type: 'varchar', length: 20 })
  ref_type!: SpecialCollectionRefType;

  /** เก็บเป็น string เพราะ ref บางชนิดเป็น pro_code (varchar) บางชนิดเป็น id (int) */
  @Column({ type: 'varchar', length: 50 })
  ref_id!: string;

  /** ให้แอดมินตั้งชื่อที่แสดงในหน้ารวมทับของเดิมได้ */
  @Column({ length: 200, nullable: true })
  title_override?: string;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(() => SpecialCollectionEntity, (collection) => collection.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'collection_id',
    foreignKeyConstraintName: 'FK_special_collection_item_collection',
  })
  collection!: SpecialCollectionEntity;
}
