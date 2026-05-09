import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Relation,
} from 'typeorm';
import { RatingEntity } from './rating.entity';

@Entity({ name: 'image_review' })
export class ImageReviewEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text' })
  img_url!: string;

  @Column()
  rating_id!: number;

  @ManyToOne(() => RatingEntity, (rating) => rating.images, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'rating_id' })
  rating!: Relation<RatingEntity>;
}
