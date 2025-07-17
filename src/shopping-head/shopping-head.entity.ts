import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { MemberEntity } from 'src/members/members.entity';
import { ShoppingOrderEntity } from 'src/shopping-order/shopping-order.entity';

@Entity({ name: 'shopping_head' })
export class ShoppingHeadEntity {
  @PrimaryGeneratedColumn()
  soh_id: number;

  @Column({ length: 11 })
  soh_runing: string;

  @CreateDateColumn()
  soh_datetime: Date;

  @Column({ type: 'datetime', nullable: true })
  soh_saledate: Date;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  soh_lottotal: number;

  @ManyToOne(() => MemberEntity, (member) => member.orders)
  @JoinColumn({ name: 'mem_id' })
  member: MemberEntity;

  @OneToMany(() => ShoppingOrderEntity, (detail) => detail.orderHeader)
  details: ShoppingOrderEntity[];
}
