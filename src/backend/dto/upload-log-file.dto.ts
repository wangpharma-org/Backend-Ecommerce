import { ApiProperty } from '@nestjs/swagger';

export class UploadLogFileDto {
  @ApiProperty({ example: 'wangday-import', description: 'Required; not empty' })
  feature: string;

  @ApiProperty({ example: 'import-2026-06-23.csv', description: 'Required; not empty' })
  filename: string;
}
