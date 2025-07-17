import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { EmployeeEntity } from 'src/employees/employees.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';

@Entity({ name: 'member' })
export class MemberEntity {
  @PrimaryGeneratedColumn()
  mem_id: number;

  @Column({ unique: true, length: 20 })
  mem_code: string;

  @Column({ unique: true, length: 20 })
  mem_username: string;

  @Column({ length: 255 })
  mem_password: string;

  @Column({ length: 255 })
  mem_nameSite: string;

  @Column({ length: 120, nullable: true })
  mem_license: string;

  @Column({ length: 7, nullable: true })
  mem_daystart: string;

  @Column({ length: 7, nullable: true })
  mem_dayend: string;

  @Column({ type: 'time', nullable: true })
  mem_timestart: string;

  @Column({ type: 'time', nullable: true })
  mem_timeend: string;

  @Column({ length: 1, nullable: true })
  mem_type_id: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true })
  mem_price_varchar: number;

  @Column({ length: 120, nullable: true })
  mem_taxid: string;

  @Column({ length: 255, nullable: true })
  mem_suboffice: string;

  @Column({ length: 120, nullable: true })
  mem_address: string;

  @Column({ length: 120, nullable: true })
  mem_village: string;

  @Column({ length: 120, nullable: true })
  mem_alley: string;

  @Column({ length: 120, nullable: true })
  mem_road: string;

  @Column({ length: 120, nullable: true })
  mem_province: string;

  @Column({ length: 120, nullable: true })
  mem_amphur: string;

  @Column({ length: 120, nullable: true })
  mem_tumbon: string;

  @Column({ length: 20, nullable: true })
  mem_post: string;

  @Column({ length: 200, nullable: true })
  mem_salepoffice: string;

  @Column({ length: 255, nullable: true })
  mem_img1: string;

  @Column({ length: 255, nullable: true })
  mem_img2: string;

  @Column({ length: 255, nullable: true })
  mem_img3: string;

  @Column({ type: 'decimal', precision: 6, scale: 2, default: 0 })
  mem_Ccoin: number;

  @Column({ type: 'decimal', precision: 16, scale: 2, default: 0 })
  mem_license_decimal: number;

  @ManyToOne(() => EmployeeEntity, (employee) => employee.members, {
    nullable: true,
  })
  @JoinColumn({ name: 'emp_id_ref' })
  employee: EmployeeEntity;

  @OneToMany(() => ShoppingCartEntity, (cart) => cart.member)
  shoppingCartItems: ShoppingCartEntity[];

  @OneToMany(() => ShoppingHeadEntity, (orderHd) => orderHd.member)
  orders: ShoppingHeadEntity[];
}
