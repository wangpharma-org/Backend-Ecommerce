import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "wangday", database: "ecommerce_db_backend" })
export class WangDay {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: string;

  @Column({ unique: true, type: 'decimal', precision: 10, scale: 2 })
  sh_running: string;

  @Column()
  wang_code: string;

  @Column()
  sumprice: string; //มูลค่ารวม + vat
}
