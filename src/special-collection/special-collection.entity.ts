import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  DeleteDateColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SpecialCollectionItemEntity } from './special-collection-item.entity';
import { SpecialCollectionAudienceEntity } from './special-collection-audience.entity';

/** 'all' = ทุกร้านเห็น | 'selected' = เฉพาะร้านใน special_collection_audience */
export type SpecialCollectionAudienceScope = 'all' | 'selected';

@Entity({ name: 'special_collection' })
export class SpecialCollectionEntity {
  @PrimaryGeneratedColumn()
  collection_id!: number;

  @Column({ length: 200 })
  name!: string;

  @Column({ length: 500, nullable: true })
  description?: string;

  @Column({ default: false })
  status!: boolean;

  @Column({ type: 'datetime', nullable: true })
  start_date?: Date;

  @Column({ type: 'datetime', nullable: true })
  end_date?: Date;

  @Column({ type: 'varchar', length: 10, default: 'all' })
  audience_scope!: SpecialCollectionAudienceScope;

  @Column({ type: 'int', default: 0 })
  sort_order!: number;

  @DeleteDateColumn({ nullable: true })
  deleted_at?: Date;

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;

  @OneToMany(() => SpecialCollectionItemEntity, (item) => item.collection, {
    cascade: true,
  })
  items!: SpecialCollectionItemEntity[];

  @OneToMany(
    () => SpecialCollectionAudienceEntity,
    (audience) => audience.collection,
    { cascade: true },
  )
  audiences!: SpecialCollectionAudienceEntity[];
}
