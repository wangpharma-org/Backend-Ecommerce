import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchProductsDto {
  @ApiProperty({ example: 'paracetamol', description: 'Required; empty string returns unfiltered results' })
  keyword: string;

  @ApiProperty({ example: 0, description: 'Required' })
  offset: number;

  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional' })
  sort_by?: number;

  @ApiProperty({ example: 20, description: 'Required' })
  limit: number;

  @ApiPropertyOptional({
    type: [String],
    example: ['C001', 'C002'],
    description: 'Optional filter by creditor codes',
  })
  creditor_codes?: string[];
}
