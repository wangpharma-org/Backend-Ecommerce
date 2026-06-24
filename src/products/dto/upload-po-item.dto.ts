import { ApiProperty } from '@nestjs/swagger';

export class UploadPoItemDto {
  @ApiProperty({ example: 'P00123', description: 'Required; product code, not empty' })
  pro_code: string;

  @ApiProperty({ example: 6, description: 'Required; month number 1-12' })
  month: number;
}
