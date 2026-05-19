import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ProductReturnEntity } from './product-return.entity';

@Entity('product_return_images')
export class ProductReturnImageEntity {
  @PrimaryGeneratedColumn()
  image_id: number;

  @Index()
  @ManyToOne(() => ProductReturnEntity, (ret) => ret.images, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'return_id' })
  returnRequest: ProductReturnEntity;

  @Column()
  return_id: number;

  @Column({ type: 'varchar', length: 500 })
  image_url: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  image_key: string; // Key in storage: ${Date.now()}-${random}-${filename}

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  uploaded_at: Date;
}
