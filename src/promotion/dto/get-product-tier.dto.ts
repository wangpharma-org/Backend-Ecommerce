import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetProductTierDto {
  @ApiProperty({ example: 5, description: 'Required' })
  tier_id: number;

  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional' })
  sort_by?: number;
}
