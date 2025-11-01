import { ProductEntity } from 'src/products/products.entity';
import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity()
export class Imagedebug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: '' })
  imageUrl: string;

  @OneToOne(() => ProductEntity, (product) => product.imagedebug)
  @JoinColumn({ name: 'pro_code' })
  relatedImage: ProductEntity;
}
