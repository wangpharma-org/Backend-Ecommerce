import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DrugTypeEntity } from './drug-type.entity';

export type DrugTypeRewardType = 'FREE' | 'BUNDLE';

const nullableDecimal = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value == null ? null : Number(value)),
};

/**
 * WGDD-427 สินค้าแถม (FREE) / ขายพ่วง (BUNDLE) ของประเภทยา — นับแยกต่อสินค้า
 * ซื้อสินค้าในประเภทครบ buy_qty buy_unit → ได้/พ่วง reward_qty reward_unit
 * หน่วยของแถมเป็นหน่วยของสินค้าแถมเอง ห้ามแปลงด้วย ratio ของสินค้าหลัก (G-001)
 * ทั้งชุดถูกแทนที่ทุกครั้งที่ได้ข้อความใหม่ (ไม่มี id จากต้นทาง)
 */
@Entity({ name: 'drug_type_reward' })
@Index('IDX_drug_type_reward_type', ['drug_type_code'])
export class DrugTypeRewardEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 50 })
  drug_type_code!: string;

  @ManyToOne(() => DrugTypeEntity, (drugType) => drugType.rewards, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  @JoinColumn({ name: 'drug_type_code' })
  drugType?: DrugTypeEntity;

  @Column({ type: 'varchar', length: 10 })
  reward_type!: DrugTypeRewardType;

  // pro_code ของสินค้าแถม/พ่วง (ไม่ทำ FK — สินค้าอาจยังไม่ sync มาถึง)
  @Column({ type: 'varchar', length: 50 })
  product_code!: string;

  @Column({ type: 'int' })
  buy_qty!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  buy_unit!: string | null;

  @Column({ type: 'int' })
  reward_qty!: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  reward_unit!: string | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: nullableDecimal,
  })
  bundle_price!: number | null;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note!: string | null;
}
