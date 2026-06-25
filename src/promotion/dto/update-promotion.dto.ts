import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePromotionDto {
  @ApiProperty({ example: 12, description: 'Required' })
  promo_id: number;

  @ApiPropertyOptional({ example: 'โปรโมชั่นซัมเมอร์', description: 'Optional; empty string allowed' })
  promo_name?: string;

  @ApiPropertyOptional({ example: '2026-08-01T00:00:00Z', description: 'Optional' })
  start_date?: Date;

  @ApiPropertyOptional({ example: '2026-08-31T23:59:59Z', description: 'Optional' })
  end_date?: Date;

  @ApiPropertyOptional({ example: true, description: 'Optional' })
  status?: boolean;
}
