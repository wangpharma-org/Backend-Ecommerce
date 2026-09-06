import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { SpecialCollectionEntity } from './special-collection.entity';

/** ร้านที่มองเห็นคอลเลกชันนี้ — ใช้เมื่อ audience_scope = 'selected' เท่านั้น */
@Entity({ name: 'special_collection_audience' })
@Index(['mem_code'])
@Unique('UQ_special_collection_audience', ['collection_id', 'mem_code'])
export class SpecialCollectionAudienceEntity {
  @PrimaryGeneratedColumn()
  audience_id!: number;

  @Column({ type: 'int' })
  collection_id!: number;

  @Column({ length: 30 })
  mem_code!: string;

  @CreateDateColumn()
  created_at!: Date;

  @ManyToOne(
    () => SpecialCollectionEntity,
    (collection) => collection.audiences,
    { nullable: false, onDelete: 'CASCADE' },
  )
  @JoinColumn({ name: 'collection_id' })
  collection!: SpecialCollectionEntity;
}
