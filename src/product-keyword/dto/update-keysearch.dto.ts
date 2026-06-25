import { ApiProperty } from '@nestjs/swagger';

export class UpdateKeysearchDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 'พารา,แก้ปวด', description: 'Optional; empty string allowed' })
  keysearch: string;

  @ApiProperty({ example: 0, description: 'Optional' })
  viewers: number;
}
