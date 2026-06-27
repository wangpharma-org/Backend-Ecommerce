import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddProductCartDto {
  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 'กล่อง', description: 'Required; not empty' })
  pro_unit: string;

  @ApiProperty({ example: 2, description: 'Required' })
  amount: number;

  @ApiProperty({ example: '', description: 'Required; pass empty string if not a flash-sale item' })
  flashsale_end: string;

  @ApiPropertyOptional({ type: 'string', example: '1', description: 'Optional' })
  cartVersion?: string | number;

  @ApiPropertyOptional({ example: '1.0.0', description: 'Optional' })
  clientVersion?: string;

  @ApiPropertyOptional({ example: '', description: 'Optional; empty string allowed' })
  company_day_source?: string;
}
