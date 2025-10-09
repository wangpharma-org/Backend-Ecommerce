import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ReductionInvoiceRT } from './reduct-invoice-rt.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity()
export class ReductionInvoiceRTDetail {
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

  @ManyToOne(() => ReductionInvoiceRT, (reductionRT) => reductionRT.details)
  @JoinColumn({ name: 'RT_id', referencedColumnName: 'RT_id' })
  reductionInvoiceRT: ReductionInvoiceRT;

  @ManyToOne(
    () => ProductEntity,
    (product) => product.reductionInvoiceRTDetails,
  )
  @JoinColumn({ name: 'pro_code', referencedColumnName: 'pro_code' })
  product: ProductEntity;
}
