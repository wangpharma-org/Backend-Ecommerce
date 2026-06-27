import { ApiProperty } from '@nestjs/swagger';

export class DuplicatePromotionDto {
  @ApiProperty({ example: 12, description: 'Required' })
  promo_id: number;

  @ApiProperty({ example: '2026-08-01T00:00:00Z', description: 'Required' })
  start_date: Date;

  @ApiProperty({ example: '2026-08-31T23:59:59Z', description: 'Required' })
  end_date: Date;
}
