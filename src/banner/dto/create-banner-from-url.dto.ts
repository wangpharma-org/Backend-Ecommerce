import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBannerFromUrlDto {
  @ApiProperty({ example: 'https://cdn.wangpharma.com/banners/abc.jpg', description: 'Required' })
  img_url: string;

  @ApiPropertyOptional({ example: 'Summer Sale', description: 'Optional; empty string allowed' })
  banner_name?: string;

  @ApiPropertyOptional({
    enum: ['store_carousel', 'landing_hero', 'popup', 'sidebar'],
    example: 'landing_hero',
    description: 'Optional',
  })
  banner_location?: 'store_carousel' | 'landing_hero' | 'popup' | 'sidebar';

  @ApiProperty({ example: '2026-07-01T00:00:00Z', description: 'Required' })
  date_start: Date;

  @ApiProperty({ example: '2026-07-31T23:59:59Z', description: 'Required' })
  date_end: Date;
}
