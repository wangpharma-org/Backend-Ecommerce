import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  ManyToMany,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { ReductionInvoiceRTDetail } from './reduct-invoice-rt-detail.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity()
export class ReductionInvoiceRT {
  @PrimaryGeneratedColumn()
  RT_id: number;

  @Column({ nullable: true, default: null })
  invoice: string;

  @Column({ nullable: true, default: null })
  date: string;

  @Column({ nullable: true, default: null })
  mem_code: string;

  @Column({ type: 'text', nullable: true, default: null })
  pro_amount: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    default: null,
  })
  dis_price: string;

  @ManyToOne(() => UserEntity, (user) => user.reductionInvoiceRTs)
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;

  @OneToMany(
    () => ReductionInvoiceRTDetail,
    (detail) => detail.reductionInvoiceRT,
  )
  @JoinColumn({ name: 'RT_id' })
  details: ReductionInvoiceRTDetail[];

  @ManyToMany(
    () => ProductEntity,
    (product) => product.reductionInvoiceRTDetails,
  )
  products: ProductEntity[];
}
