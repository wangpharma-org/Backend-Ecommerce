import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { ProductLabelMatchType } from './product-label-match-type';

@Entity('product_label_rules')
@Unique('UQ_product_label_rules_keyword', ['keyword'])
export class ProductLabelRuleEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  label!: string;

  @Column({ type: 'varchar', length: 255 })
  keyword!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ProductLabelMatchType.CONTAINS,
  })
  matchType!: ProductLabelMatchType;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
