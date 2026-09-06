import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * กระเช้าหนึ่งก้อนที่ลูกค้าประกอบเองแล้วใส่ตะกร้า
 * แถวใน shopping_cart ที่มี basket_id เดียวกัน = กระเช้าเดียวกัน
 * ต้องอยู่หรือหายไปพร้อมกันทั้งก้อน
 */
@Entity({ name: 'cart_basket' })
export class CartBasketEntity {
  @PrimaryGeneratedColumn()
  basket_id!: number;

  @Index()
  @Column({ length: 30 })
  mem_code!: string;

  @Index()
  @Column({ type: 'int' })
  promo_id!: number;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
