import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

export type BannerLocation = 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';
export type BannerDisplayType = 'image_only' | 'text_only' | 'image_with_text';
export type TextColor = 'light' | 'dark';
export type TextPosition = 'left' | 'center' | 'right';

@Entity({ name: 'banner' })
export class BannerEntity {
  @PrimaryGeneratedColumn()
  banner_id: number;

  @Column({ nullable: true })
  banner_image: string;

  @Column({ nullable: true })
  banner_name: string;

  @Column({
    type: 'enum',
    enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
    default: 'store_carousel',
  })
  banner_location: BannerLocation;

  @Column({ nullable: true })
  date_start: Date;

  @Column({ nullable: true })
  date_end: Date;

  @Column({ nullable: true })
  link_url: string;

  @Column({ default: true })
  is_active: boolean;

  // Display settings (for landing_hero)
  @Column({
    type: 'enum',
    enum: ['image_only', 'text_only', 'image_with_text'],
    default: 'image_only',
  })
  display_type: BannerDisplayType;

  // Rich content fields
  @Column({ nullable: true })
  title: string;

  @Column({ nullable: true })
  subtitle: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  cta_text: string;

  @Column({ nullable: true })
  cta_url: string;

  @Column({ nullable: true })
  cta_secondary_text: string;

  @Column({ nullable: true })
  cta_secondary_url: string;

  // Style settings
  @Column({
    type: 'enum',
    enum: ['light', 'dark'],
    default: 'dark',
  })
  text_color: TextColor;

  @Column({
    type: 'enum',
    enum: ['left', 'center', 'right'],
    default: 'left',
  })
  text_position: TextPosition;

  @Column({ nullable: true })
  bg_gradient: string;

  @Column({ nullable: true, default: 0 })
  sort_order: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', onUpdate: 'CURRENT_TIMESTAMP' })
  updated_at: Date;
}
