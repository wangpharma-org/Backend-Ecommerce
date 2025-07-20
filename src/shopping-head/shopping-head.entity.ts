import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { UserEntity } from 'src/users/users.entity';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';

@Entity({ name: 'shopping_head' })
export class ShoppingHeadEntity {
  @PrimaryGeneratedColumn()
  soh_id: number;

  @Column({ length: 20, nullable: true, unique: true })
  soh_running: string;

  @CreateDateColumn()
  soh_datetime: Date;

  @Column({ type: 'datetime', nullable: true })
  soh_saledate: Date;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
    nullable: true,
  })
  soh_sumprice: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
    nullable: true,
  })
  soh_coin_recieve: number;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    default: 0,
    nullable: true,
  })
  soh_coin_use: number;

  @Column({ length: 50, nullable: true })
  soh_payment_type: string;

  @Column({ length: 50, nullable: true })
  soh_shipping_type: string;

  @Column({ default: 0, nullable: true })
  soh_listsale: number;

  @Column({ default: 0, nullable: true })
  soh_free: number;

  @ManyToOne(() => UserEntity, (member) => member.orders)
  @JoinColumn({ name: 'mem_code' })
  member: UserEntity;

  @OneToMany(() => ShoppingOrderEntity, (detail) => detail.orderHeader)
  details: ShoppingOrderEntity[];
}
