import { ProductEntity } from 'src/products/products.entity';
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Imagedebug {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ nullable: true, default: '' })
  imageUrl: string;

  @ManyToOne(() => ProductEntity, (product) => product.imagedebug)
  relatedImage: ProductEntity;

  @Column({ nullable: false })
  row_image: string;
}
