import { ApiProperty } from '@nestjs/swagger';

export class GetProductDetailDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;
}
