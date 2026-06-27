import { ApiProperty } from '@nestjs/swagger';

export class ProductForYouDto {
  @ApiProperty({ example: '', description: 'Required; empty string allowed' })
  keyword: string;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}
