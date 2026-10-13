import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
  DeleteDateColumn,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { CreditorEntity } from '../products/creditor.entity';

@Entity({ name: 'promotion' })
export class PromotionEntity {
  @PrimaryGeneratedColumn()
  promo_id!: number;

  @ManyToOne(() => CreditorEntity, (creditor) => creditor.promotions, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'creditor_code', referencedColumnName: 'creditor_code' })
  creditor!: CreditorEntity;

  // บริษัททั้งหมดที่เข้าร่วม Company Day นี้ (รวมตัวหลักใน creditor ด้วย) — creditor ยังเป็นตัวหลักที่ใช้แยก company/wang
  @ManyToMany(() => CreditorEntity)
  // synchronize: false — ตารางสร้างโดย migration 20261008000100 (ตั้งชื่อ index/FK เอง)
  // TypeORM ตั้งชื่อ index ของ junction table เองไม่ได้ ถ้าไม่ปิด migration:generate จะ DROP/สร้างใหม่ทุกครั้ง
  @JoinTable({
    name: 'promotion_creditor',
    synchronize: false,
    joinColumn: { name: 'promo_id', referencedColumnName: 'promo_id' },
    inverseJoinColumn: {
      name: 'creditor_code',
      referencedColumnName: 'creditor_code',
    },
  })
  creditors!: CreditorEntity[];

  @Column({ length: 255 })
  promo_name!: string;

  @Column({ type: 'datetime' })
  start_date!: Date;

  @Column({ type: 'datetime' })
  end_date!: Date;

  @Column({ default: false })
  status!: boolean;

  @Column({ type: 'varchar', nullable: true, default: null, length: 500 })
  promo_poster!: string | null;

  @DeleteDateColumn({ nullable: true })
  deleted_at!: Date;

  @OneToMany(() => PromotionTierEntity, (tier) => tier.promotion)
  tiers!: PromotionTierEntity[];
}
