import { ApiProperty } from '@nestjs/swagger';

export class AddToFavoriteDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}
