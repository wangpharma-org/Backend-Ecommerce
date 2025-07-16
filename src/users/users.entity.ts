import { Entity, Column, PrimaryColumn } from 'typeorm';

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

  @Column({ nullable: true, default: null })
  mem_timestart: Date;

  @Column({ nullable: true, default: null })
  mem_timeend: Date;

  @Column({ nullable: true, default: null })
  mem_type: number;

  @Column({ length: 6, nullable: true, default: null })
  mem_price: string;

  @Column({ length: 60, nullable: true, default: null })
  mem_taxid: string;

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

  @Column({ length: 500, nullable: true, default: null })
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

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  mem_Rcoin: number;
}
