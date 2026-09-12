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
  /** กระเช้าที่ลูกค้าประกอบเองจากโปร — null เมื่อเป็นกระเช้าสำเร็จรูป */
  @Column({ type: 'int', nullable: true, default: null })
  promo_id!: number | null;

  /** กระเช้าสำเร็จรูป (bundle_set) — null เมื่อเป็นกระเช้าโปร */
  // union type ทำให้ reflect-metadata ได้ "Object" — ต้องบอก type เอง ไม่งั้น TypeORM ล้มตอน boot
  @Column({ type: 'varchar', length: 30, nullable: true, default: null })
  set_code!: string | null;

  @Column({ type: 'int', nullable: true, default: null })
  set_qty!: number | null;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
