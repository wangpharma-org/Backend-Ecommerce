import { ProductEntity } from 'src/products/products.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { BannerHotdealEntity } from './hotdeal-banner.entity';

@Entity()
// unique index เก่าที่มีอยู่แล้วใน DB — ซ้ำกับ REL_a5848... ที่ @OneToOne สร้างให้
// ประกาศไว้เพื่อไม่ให้ migration:generate drop ทิ้ง ถ้าจะเอาออกให้เขียน migration แยกอย่างตั้งใจ
@Index('IDX_a5848859c3cbbf247db852e323', ['product'], { unique: true })
export class HotdealEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @OneToOne(() => ProductEntity, (product) => product.hotdeal)
  @JoinColumn({ name: 'pro_code1' })
  product!: ProductEntity;

  @Column({ length: 20, default: '0' })
  pro1_amount!: string;

  @Column({ length: 20, nullable: false })
  pro1_unit!: string;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'pro_code2' })
  product2!: ProductEntity;

  @Column({ length: 20, default: '0' })
  pro2_amount!: string;

  @Column({ length: 20, nullable: false })
  pro2_unit!: string;

  @Column({ type: 'int', default: 0 })
  order!: number;

  @Column({ default: false })
  special_deal!: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  promo_title!: string | null;

  @Column({ type: 'text', nullable: true })
  promo_body!: string | null;

  @OneToOne(() => BannerHotdealEntity, (banner) => banner.hotdeal, {
    cascade: true,
  })
  banner_hotdeal!: BannerHotdealEntity;
}
