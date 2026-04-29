import {
  Column,
  DeleteDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Entity('delete_cart')
export class DeleteCartEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'json' })
  data!: Record<string, unknown>;

  @Column({ type: 'varchar' })
  mem_code!: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'CASCADE' })
  product!: ProductEntity;

  @DeleteDateColumn({ nullable: true })
  deletedAt!: Date | null;
}
