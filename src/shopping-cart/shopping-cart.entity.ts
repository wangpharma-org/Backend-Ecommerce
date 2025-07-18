import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { ProductEntity } from 'src/products/products.entity';

@Entity({ name: 'shopping_cart' })
export class ShoppingCartEntity {
  @PrimaryGeneratedColumn()
  spc_id: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spc_amount: number;

  @Column({ length: 3, nullable: true })
  spc_unit: string;

  @Column({ length: 20 })
  pro_code: string;

  @Column({ length: 30 })
  mem_code: string;

  @Column({ default: true })
  spc_checked: boolean;

  // @Column({ type: 'enum', enum: ['1', '2', '3'], nullable: true })
  // spc_unit: '1' | '2' | '3';

  @Column({ type: 'timestamp' })
  spc_datetime: Date;

  @Column({ type: 'text', nullable: true })
  spc_comments: string;

  @ManyToOne(() => UserEntity, (member) => member.shoppingCartItems)
  @JoinColumn({ name: 'mem_code' }) // Using ID for relation
  member: UserEntity;

  @ManyToOne(() => ProductEntity, (product) => product.inCarts)
  @JoinColumn({ name: 'pro_code' }) // Using ID for relation
  product: ProductEntity;
}
