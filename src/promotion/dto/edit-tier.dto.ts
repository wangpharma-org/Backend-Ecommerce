import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EditTierDto {
  @ApiProperty({ example: 5, description: 'Required' })
  tier_id: number;

  @ApiPropertyOptional({ example: 'Gold', description: 'Optional; empty string allowed' })
  tier_name?: string;

  @ApiPropertyOptional({ example: 1000, description: 'Optional' })
  min_amount?: number;

  @ApiPropertyOptional({ example: 'ซื้อครบ 1,000 บาท', description: 'Optional; empty string allowed' })
  description?: string;

  @ApiPropertyOptional({ example: 'รับส่วนลด 10%', description: 'Optional; empty string allowed' })
  detail?: string;
}
