import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GetFlashSaleDto {
  @ApiProperty({ example: 20, description: 'Required' })
  limit: number;

  @ApiPropertyOptional({
    example: 'M00123',
    description: 'Optional; overridden by JWT member code if present',
  })
  mem_code?: string;
}
