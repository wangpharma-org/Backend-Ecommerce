import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteFavoriteDto {
  @ApiProperty({ example: 101, description: 'Required' })
  fav_id: number;

  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;

  @ApiPropertyOptional({ example: 1, description: 'Optional' })
  sort_by?: number;
}
