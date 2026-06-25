import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddPromotionDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Required; promotion poster image' })
  file: unknown;

  @ApiProperty({ example: 'โปรโมชั่นซัมเมอร์', description: 'Required; not empty' })
  promo_name: string;

  @ApiPropertyOptional({ example: 'C001', description: 'Optional; empty string treated as no creditor' })
  creditor_code: string;

  @ApiProperty({ example: '2026-07-01T00:00:00Z', description: 'Required' })
  start_date: Date;

  @ApiProperty({ example: '2026-07-31T23:59:59Z', description: 'Required' })
  end_date: Date;

  @ApiProperty({ enum: ['true', 'false'], example: 'true', description: 'Required; string "true"/"false"' })
  status: string;
}
