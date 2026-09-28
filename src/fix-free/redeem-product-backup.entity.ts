import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';

// ตั้งชื่อ index/FK ให้ตรงกับที่ migration release-1.48.0 สร้างไว้ ไม่งั้น migration:generate จะ drop ทิ้ง
// UQ_ = สินค้าสำรองหนึ่งตัวผูกได้กับสินค้าแลกแต้มตัวเดียว
@Entity({ name: 'redeem_product_backup' })
@Index('IDX_redeem_product_backup_code', ['backupProductCode'])
@Index('UQ_redeem_product_backup_code', ['backupProductCode'], { unique: true })
export class RedeemProductBackupEntity {
  @PrimaryColumn({ type: 'varchar', length: 20, name: 'redeem_product_code' })
  redeemProductCode!: string;

  @Column({ type: 'varchar', length: 20, name: 'backup_product_code' })
  backupProductCode!: string;

  // relation มีไว้ให้ TypeORM รู้จัก FK เท่านั้น — โค้ดยังอ่าน/เขียนผ่าน *ProductCode ตามเดิม
  @ManyToOne(() => ProductEntity, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'redeem_product_code',
    referencedColumnName: 'pro_code',
    foreignKeyConstraintName: 'FK_redeem_product_backup_primary',
  })
  redeemProduct?: ProductEntity;

  // RESTRICT — ห้ามลบสินค้าที่ยังถูกใช้เป็นตัวสำรองอยู่
  @ManyToOne(() => ProductEntity, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({
    name: 'backup_product_code',
    referencedColumnName: 'pro_code',
    foreignKeyConstraintName: 'FK_redeem_product_backup_backup',
  })
  backupProduct?: ProductEntity;
}
