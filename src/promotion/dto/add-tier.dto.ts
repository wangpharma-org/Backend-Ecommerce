import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddTierDto {
  @ApiPropertyOptional({ type: 'string', format: 'binary', description: 'Optional; tier poster image' })
  file?: unknown;

  @ApiProperty({ example: 12, description: 'Required' })
  promo_id: number;

  @ApiProperty({ example: 'Gold', description: 'Required; not empty' })
  tier_name: string;

  @ApiProperty({ example: 1000, description: 'Required' })
  min_amount: number;

  @ApiPropertyOptional({ example: 'ซื้อครบ 1,000 บาท', description: 'Optional; empty string allowed' })
  description?: string;

  @ApiPropertyOptional({ example: 'รับส่วนลด 10%', description: 'Optional; empty string allowed' })
  detail?: string;

  @ApiPropertyOptional({
    enum: ['true', 'false'],
    example: 'false',
    description: 'Optional; string "true"/"false"',
  })
  is_unit_based?: string;
}
