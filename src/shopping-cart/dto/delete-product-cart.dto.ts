import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DeleteProductCartDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiPropertyOptional({ example: '1.0.0', description: 'Optional' })
  clientVersion?: string;
}
