import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBannerDto {
  @ApiPropertyOptional({
    example: 'https://wang-storage.sgp1.digitaloceanspaces.com/banners/summer.jpg',
    description: 'Optional; empty string allowed',
  })
  banner_image?: string;

  @ApiPropertyOptional({ example: 'Summer Sale', description: 'Optional; empty string allowed' })
  banner_name?: string;

  @ApiPropertyOptional({
    enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
    example: 'landing_hero',
    description: 'Optional',
  })
  banner_location?: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';

  @ApiPropertyOptional({ example: '2026-07-01T00:00:00Z', description: 'Optional' })
  date_start?: Date;

  @ApiPropertyOptional({ example: '2026-07-31T23:59:59Z', description: 'Optional' })
  date_end?: Date;

  @ApiPropertyOptional({ example: 'https://wangpharma.com/promo', description: 'Optional; empty string allowed' })
  link_url?: string;

  @ApiPropertyOptional({ example: true, description: 'Optional; defaults to true' })
  is_active?: boolean;

  @ApiPropertyOptional({
    enum: ['image_only', 'text_only', 'image_with_text'],
    example: 'image_with_text',
    description: 'Optional',
  })
  display_type?: 'image_only' | 'text_only' | 'image_with_text';

  @ApiPropertyOptional({ example: 'ลดราคาช่วงซัมเมอร์', description: 'Optional; empty string allowed' })
  title?: string;

  @ApiPropertyOptional({ example: 'สูงสุด 50%', description: 'Optional; empty string allowed' })
  subtitle?: string;

  @ApiPropertyOptional({ example: 'โปรโมชั่นพิเศษเฉพาะเดือนนี้', description: 'Optional; empty string allowed' })
  description?: string;

  @ApiPropertyOptional({ example: 'ดูเพิ่มเติม', description: 'Optional; empty string allowed' })
  cta_text?: string;

  @ApiPropertyOptional({ example: 'https://wangpharma.com/promo', description: 'Optional; empty string allowed' })
  cta_url?: string;

  @ApiPropertyOptional({ example: 'ปิด', description: 'Optional; empty string allowed' })
  cta_secondary_text?: string;

  @ApiPropertyOptional({ example: '', description: 'Optional; empty string allowed' })
  cta_secondary_url?: string;

  @ApiPropertyOptional({ enum: ['light', 'dark'], example: 'light', description: 'Optional; defaults to dark' })
  text_color?: 'light' | 'dark';

  @ApiPropertyOptional({
    enum: ['left', 'center', 'right'],
    example: 'center',
    description: 'Optional; defaults to left',
  })
  text_position?: 'left' | 'center' | 'right';

  @ApiPropertyOptional({
    example: 'linear-gradient(90deg,#000,#fff)',
    description: 'Optional; empty string allowed',
  })
  bg_gradient?: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional; defaults to 0' })
  sort_order?: number;

  @ApiPropertyOptional({ example: false, description: 'Optional; defaults to false' })
  is_drug?: boolean;

  @ApiPropertyOptional({ example: 'ADV001', description: 'Optional; empty string allowed' })
  advertise_code?: string;

  @ApiPropertyOptional({ example: 'V001', description: 'Optional; empty string allowed' })
  creditor?: string;

  @ApiPropertyOptional({ example: 'A001,A002,A003', description: 'Optional; empty string allowed' })
  product_list?: string;
}
