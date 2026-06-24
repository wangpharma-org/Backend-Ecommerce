import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CheckProductCartAllDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ enum: ['check', 'uncheck'], example: 'check', description: 'Required; not empty' })
  type: string;

  @ApiPropertyOptional({ example: '1.0.0', description: 'Optional' })
  clientVersion?: string;
}
