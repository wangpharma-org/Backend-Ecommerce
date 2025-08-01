import { Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';

@Entity({ name: 'favorite' })
export class FavoriteEntity {
  @PrimaryGeneratedColumn()
  fav_id: number;

  @ManyToOne(() => ProductEntity, (product) => product.inFavorite)
  @JoinColumn({ name: 'pro_code' })
  product: ProductEntity;

  @ManyToOne(() => UserEntity, (member) => member.favorite)
  @JoinColumn({ name: 'mem_code' })
  member: UserEntity;
}
