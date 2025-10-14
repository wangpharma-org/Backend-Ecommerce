import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReductionRT } from './reduct-rt.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity()
export class ReductionRTDetail {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'text', nullable: true, default: null })
  pro_amount: string;

  @Column({ nullable: true, default: null })
  pro_unit: string;

  @Column({
    nullable: true,
    default: null,
  })
  pro_price_per_unit: string;

  @Column({
    nullable: true,
    default: null,
  })
  pro_discount: string;

  @ManyToOne(() => ReductionRT, (reductionRT) => reductionRT.details)
  @JoinColumn({ name: 'RT_id', referencedColumnName: 'RT_id' })
  reductionRT: ReductionRT;

  @ManyToOne(() => ProductEntity, (product) => product.reductionRTDetails)
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product: ProductEntity;
}
