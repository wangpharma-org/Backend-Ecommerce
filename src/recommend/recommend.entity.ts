import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';

@Entity({ name: 'recommend' })
export class RecommendEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 150, unique: true })
  tag: string;

  @OneToMany(() => ProductEntity, (product) => product.recommend)
  products: ProductEntity[];
}
