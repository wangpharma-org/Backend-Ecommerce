import { ProductEntity } from 'src/products/products.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
@Index('uk_imagedebug_pro_code', ['relatedImage'], { unique: true })
export class Imagedebug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: '' })
  imageUrl: string;

  @OneToOne(() => ProductEntity, (product) => product.imagedebug)
  @JoinColumn({ name: 'pro_code' })
  relatedImage: ProductEntity;
}
