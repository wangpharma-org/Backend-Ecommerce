import { Entity, PrimaryGeneratedColumn, OneToMany, Column } from 'typeorm';
import { FlashSaleProductsEntity } from './flashsale-product.entity';

@Entity({ name: 'flashsale' })
export class FlashSaleEntity {
  @PrimaryGeneratedColumn()
  promotion_id: number;

  @Column()
  promotion_name: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'time' })
  time_start: string;

  @Column({ type: 'time' })
  time_end: string;

  @Column({ default: false })
  is_active: boolean;

  @OneToMany(() => FlashSaleProductsEntity, (fsp) => fsp.flashsale)
  flashsaleProducts: FlashSaleProductsEntity[];
}
