import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DrugTypeRewardEntity } from './drug-type-reward.entity';

/**
 * WGDD-427 ประเภทยา — สำเนาจาก ProductService (ต้นทาง) ผ่าน Kafka topic drug_type_upsert_ecom
 * อ้างอิงด้วย code (Ecommerce ไม่รู้ uuid ของ ProductService) สินค้าผูกผ่าน product.drug_type_code
 */
@Entity({ name: 'drug_type' })
export class DrugTypeEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description!: string | null;

  @Column({ type: 'tinyint', width: 1, default: 1 })
  is_active!: boolean;

  @CreateDateColumn({ type: 'datetime' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'datetime' })
  updated_at!: Date;

  @OneToMany(() => DrugTypeRewardEntity, (reward) => reward.drugType)
  rewards?: DrugTypeRewardEntity[];
}
