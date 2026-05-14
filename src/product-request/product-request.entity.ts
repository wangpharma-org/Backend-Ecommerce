import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ProductRequestStatus {
  PENDING = 'pending',
  RESOLVED = 'resolved',
  REJECTED = 'rejected',
}

@Entity({ name: 'product_requests' })
export class ProductRequestEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  mem_code!: string;

  @Column({ type: 'text' })
  keyword!: string;

  @Column({ type: 'varchar', length: 255 })
  pro_name!: string;

  @Column({ type: 'text', nullable: true })
  note?: string;

  @Column({ type: 'text', nullable: true })
  img_url?: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  source_page?: string;

  @Column({ type: 'text', nullable: true })
  shown_products?: string;

  @Column({ type: 'int', nullable: true })
  current_page?: number;

  @Column({
    type: 'enum',
    enum: ProductRequestStatus,
    default: ProductRequestStatus.PENDING,
  })
  status!: ProductRequestStatus;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
