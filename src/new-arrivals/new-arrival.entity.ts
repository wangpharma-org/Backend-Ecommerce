import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProductEntity } from '../products/products.entity';

@Entity()
export class NewArrival {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ProductEntity, (product) => product.newArrivals)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'varchar', length: 20 })
  LOT: string;

  @Column({ type: 'varchar', length: 10 })
  MFG: string;

  @Column({ type: 'varchar', length: 10 })
  EXP: string;
}
