import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { CreditorEntity } from 'src/products/creditor.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity({ name: 'invisible-product' })
export class InvisibleEntity {
  @PrimaryGeneratedColumn()
  invisible_id: number;

  @Column()
  invisible_name: string;

  @Column({ type: 'date' })
  date_end: string;

  @ManyToOne(() => CreditorEntity, (creditor) => creditor.invisibleCreditor)
  @JoinColumn({ name: 'creditor_code' })
  creditor: CreditorEntity;

  @OneToMany(() => ProductEntity, (product) => product.invisibleProduct)
  products: ProductEntity[];
}
