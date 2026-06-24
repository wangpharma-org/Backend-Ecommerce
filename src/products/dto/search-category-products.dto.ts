import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SearchCategoryProductsDto {
  @ApiProperty({ example: '', description: 'Required field; empty string allowed (returns whole category)' })
  keyword: string;

  @ApiProperty({ example: 0, description: 'Required' })
  offset: number;

  @ApiProperty({ example: 5, description: 'Required' })
  category: number;

  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional' })
  sort_by?: number;

  @ApiProperty({ example: 20, description: 'Required' })
  limit: number;
}
