import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { UserEntity } from '../users/users.entity';
import { ProductEntity } from '../products/products.entity';

@Entity({ name: 'shopping_cart' })
export class ShoppingCartEntity {
  @PrimaryGeneratedColumn()
  spc_id: number;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  spc_amount: number;

  @Column({ length: 50, nullable: true })
  spc_unit: string;

  @Column({ length: 20 })
  pro_code: string;

  @Column({ length: 30 })
  mem_code: string;

  @Column({ default: true })
  spc_checked: boolean;

  @Column({ default: false })
  is_reward: boolean;

  @Column({ type: 'int', nullable: true, default: null })
  promo_id: number;

  @Column({ type: 'int', nullable: true, default: null })
  tier_id: number;

  @Column({ default: false })
  use_code: boolean;

  @Column({ type: 'datetime', default: null, nullable: true })
  flashsale_end: string | null;

  // @Column({ type: 'enum', enum: ['1', '2', '3'], nullable: true })
  // spc_unit: '1' | '2' | '3';

  @Column({ type: 'timestamp' })
  spc_datetime: Date;

  @Column({ type: 'date', nullable: true, default: null })
  reward_expire: Date;

  @Column({ type: 'text', nullable: true })
  spc_comments: string;

  @Column({ type: 'text', nullable: true })
  hotdeal_promain: string;

  @Column({ default: false })
  hotdeal_free: boolean;

  @ManyToOne(() => UserEntity, (member) => member.shoppingCartItems)
  @JoinColumn({ name: 'mem_code' }) // Using ID for relation
  member: UserEntity;

  @ManyToOne(() => ProductEntity, (product) => product.inCarts)
  @JoinColumn({ name: 'pro_code' }) // Using ID for relation
  product: ProductEntity;
}
