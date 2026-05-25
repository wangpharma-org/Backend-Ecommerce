import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ProductEntity } from './products.entity';

@Entity({ name: 'product_unit' })
export class ProductUnitEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'pro_code', length: 20 })
  pro_code!: string;

  @Column({ length: 30 })
  unit_name!: string; // เช่น ชิ้น, กล่อง, ลัง

  @Column({ type: 'int', default: 1 })
  ratio!: number; // อัตราส่วนเทียบกับหน่วยเล็กสุด

  @Column({ type: 'int' })
  level!: number; // ลำดับของหน่วย (เช่น 1=เล็กสุด, 2=กลาง, 3=ใหญ่สุด)

  @ManyToOne(() => ProductEntity, (product) => product.units, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product!: ProductEntity;
}
