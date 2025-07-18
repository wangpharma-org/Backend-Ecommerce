import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { ProductEntity } from './products.entity';

@Entity({ name: 'product_pharma' })
export class ProductPharmaEntity {
  @PrimaryGeneratedColumn()
  pp_id: number;

  @Column({ type: 'text', nullable: true })
  pp_properties: string;

  @Column({ type: 'text', nullable: true })
  pp_how_to_use: string;

  @Column({ type: 'text', nullable: true })
  pp_caution: string;

  @Column({ type: 'text', nullable: true })
  pp_preservation: string;

  @Column({ type: 'text', nullable: true })
  pp_contraindications: string;

  @Column({ type: 'text', nullable: true })
  pp_use_in_pregnant_women: string;

  @Column({ type: 'text', nullable: true })
  pp_use_in_lactating_women: string;

  @Column({ type: 'text', nullable: true })
  pp_side_effects: string;

  @Column({ type: 'text', nullable: true })
  pp_other_drug_interactions: string;

  @Column({ length: 6, nullable: true })
  pp_eatunit: string;

  @Column({ length: 11, nullable: true })
  pp_print: string;

  @OneToOne(() => ProductEntity, (product) => product.pharmaDetails)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;
}
