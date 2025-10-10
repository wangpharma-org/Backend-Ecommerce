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
import { ReductionRTDetail } from './reduct-rt-detail.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity()
export class ReductionRT {
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

  @ManyToOne(() => UserEntity, (user) => user.reductionInvoices)
  @JoinColumn({ name: 'mem_code', referencedColumnName: 'mem_code' })
  user: UserEntity;

  @OneToMany(() => ReductionRTDetail, (detail) => detail.reductionRT)
  @JoinColumn({ name: 'RT_id' })
  details: ReductionRTDetail[];

  @ManyToMany(() => ProductEntity, (product) => product.reductionRTDetails)
  products: ProductEntity[];

  @Column({ nullable: true })
  comment: string;
}
