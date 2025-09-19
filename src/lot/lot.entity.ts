import {
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';

@Entity({ name: 'lot' })
export class LotEntity {
  @PrimaryGeneratedColumn()
  lot_id: number;

  @Column({ nullable: true })
  lot: string;

  @Column({ nullable: true })
  mfg: string;

  @Column({ nullable: true })
  exp: string;

  @ManyToOne(() => ProductEntity, (product) => product.lot)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
