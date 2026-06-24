import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SaveModalContentDto {
  @ApiProperty({ example: 1, description: 'Required' })
  id: number;

  @ApiProperty({ example: 'ประกาศปิดระบบ', description: 'Required; not empty' })
  title: string;

  @ApiPropertyOptional({ example: '<p>เนื้อหา</p>', description: 'Optional; empty string allowed' })
  content?: string;

  @ApiProperty({ example: true, description: 'Required' })
  show: boolean;
}
