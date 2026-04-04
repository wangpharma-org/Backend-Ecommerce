import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type EventType =
  | 'page_view'
  | 'product_view'
  | 'product_add_cart'
  | 'product_remove_cart'
  | 'product_favorite'
  | 'product_unfavorite'
  | 'search'
  | 'filter_apply'
  | 'checkout_start'
  | 'checkout_complete'
  | 'login'
  | 'logout';

@Entity('behavior_tracking')
export class TrackingEventEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 50, nullable: true })
  mem_code: string;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  session_id: string;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  event_type: EventType;

  @Column({ type: 'varchar', length: 255, nullable: true })
  page_path: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  page_title: string;

  @Column({ type: 'varchar', length: 30, nullable: true })
  pro_code: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  search_query: string;

  @Column({ type: 'json', nullable: true })
  filters: Record<string, any>;

  @Column({ type: 'json', nullable: true })
  extra_data: Record<string, any>;

  @Column({ type: 'varchar', length: 50, nullable: true })
  referrer: string;

  @Column({ type: 'int', nullable: true })
  duration_ms: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  device_type: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  user_agent: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip_address: string;

  @Index()
  @CreateDateColumn()
  created_at: Date;
}
