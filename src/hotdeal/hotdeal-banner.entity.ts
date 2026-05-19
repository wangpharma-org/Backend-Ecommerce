import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { HotdealEntity } from './hotdeal.entity';

@Entity({ name: 'banner_hotdeal' })
export class BannerHotdealEntity {
  @PrimaryGeneratedColumn()
  banner_hotdeal_id!: number;

  @Column({ nullable: true })
  banner_url!: string;

  @OneToOne(() => HotdealEntity, (hotdeal) => hotdeal.banner_hotdeal, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'id' })
  hotdeal!: HotdealEntity;
}
