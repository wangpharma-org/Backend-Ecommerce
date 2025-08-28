import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity({ name: 'banner' })
export class BannerEntity {
  @PrimaryGeneratedColumn()
  banner_id: number;

  @Column()
  banner_image: string;

  @Column({ nullable: true })
  date_start: Date;

  @Column({ nullable: true })
  date_end: Date;
}
