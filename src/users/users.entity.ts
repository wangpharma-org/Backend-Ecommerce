import {
  Entity,
  Column,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { EmployeeEntity } from '../employees/employees.entity';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { FavoriteEntity } from '../favorite/favorite.entity';
import { DebtorEntity } from 'src/debtor/debtor.entity';
import { ChangePassword } from 'src/change-password/change-password.entity';

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ length: 30 })
  mem_code: string;

  @Column({ length: 30 })
  mem_username: string;

  @Column({ length: 30 })
  mem_password: string;

  @Column({ length: 255, nullable: true, default: null })
  mem_nameSite: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_license: string;

  @Column({ length: 7, nullable: true, default: null })
  mem_daystart: string;

  @Column({ length: 7, nullable: true, default: null })
  mem_dayend: string;

  @Column({ length: 6, nullable: true })
  mem_price: string;

  @Column({ nullable: true, default: null })
  mem_timestart: Date;

  @Column({ nullable: true, default: null })
  mem_timeend: Date;

  @Column({ nullable: true, default: null })
  mem_type: number;

  @Column({ length: 60, nullable: true, default: null })
  mem_taxid: string;

  @Column({ length: 50, nullable: true, default: null })
  mem_phone: string;

  @Column({ nullable: true, default: null })
  mem_office: boolean;

  @Column({ length: 30, nullable: true, default: null })
  mem_suboffice: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_address: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_village: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_alley: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_road: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_province: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_amphur: string;

  @Column({ length: 120, nullable: true, default: null })
  mem_tumbon: string;

  @Column({ length: 50, nullable: true, default: null })
  mem_post: string;

  @Column({ length: 700, nullable: true, default: null })
  mem_comments: string;

  @Column({ length: 10, nullable: true, default: null })
  emp_saleoffice: string;

  @Column({ length: 255, nullable: true, default: null })
  mem_img1: string;

  @Column({ length: 255, nullable: true, default: null })
  mem_img2: string;

  @Column({ length: 255, nullable: true, default: null })
  mem_img3: string;

  @Column({ length: 30, nullable: true, default: null })
  mem_route: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  mem_Ccoin: number;

  @Column({ default: false })
  permision_admin: boolean;

  @Column({ type: 'decimal', precision: 20, scale: 2, default: 0 })
  mem_Rcoin: number;

  @ManyToOne(() => EmployeeEntity, (employee) => employee.members, {
    nullable: true,
  })
  @JoinColumn({ name: 'emp_id_ref' })
  employee: EmployeeEntity;

  @OneToMany(() => ShoppingCartEntity, (cart) => cart.member)
  shoppingCartItems: ShoppingCartEntity[];

  @OneToMany(() => FavoriteEntity, (favorite) => favorite.member)
  favorite: FavoriteEntity[];

  @OneToMany(() => ShoppingHeadEntity, (orderHd) => orderHd.member)
  orders: ShoppingHeadEntity[];

  @Column({ length: 50, nullable: true, default: null })
  line_id: string;

  @Column({ length: 80, nullable: true, default: null })
  mem_email: string;

  @Column({ length: 100, nullable: true, default: null })
  website: string;

  @Column({ length: 200, nullable: true, default: null })
  facebook: string;

  @Column({ length: 15, nullable: true, default: null })
  owner_title: string;

  @Column({ length: 120, nullable: true, default: null })
  owner_name: string;

  @Column({ length: 15, nullable: true, default: null })
  owner_tel: string;

  @Column({ length: 60, nullable: true, default: null })
  owner_email: string;

  @Column({ length: 15, nullable: true, default: null })
  pharmacist_title: string;

  @Column({ length: 120, nullable: true, default: null })
  pharmacist_name: string;

  @Column({ length: 15, nullable: true, default: null })
  pharmacist_tel: string;

  @Column({ length: 60, nullable: true, default: null })
  pharmacist_email: string;

  @Column({ length: 100, nullable: true, default: null })
  mem_sgroup: string;

  @Column({ length: 150, nullable: true, default: null })
  mem_invoice_type: string;

  @OneToMany(() => DebtorEntity, (debtor) => debtor.user)
  debtors: DebtorEntity[];

  @OneToMany(() => ChangePassword, (changePassword) => changePassword.user)
  changePasswords: ChangePassword[];
}
