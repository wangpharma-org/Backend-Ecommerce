import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'wangday', database: 'ecommerce_db' })
export class WangDay {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  date: string;

  @Column({ unique: true })
  sh_running: string;

  @Column()
  wang_code: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  sumprice: string; //มูลค่ารวม + vat
}
