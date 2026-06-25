import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressBodyDto {
  @ApiPropertyOptional({ example: 'บ้าน', description: 'Optional; empty string allowed' })
  name?: string;

  @ApiProperty({ example: 'สมชาย ใจดี', description: 'Required; not empty' })
  fullName: string;

  @ApiPropertyOptional({ example: '99/1', description: 'Optional; empty string allowed' })
  mem_address?: string;

  @ApiPropertyOptional({ example: 'หมู่ 5', description: 'Optional; empty string allowed' })
  mem_village?: string;

  @ApiPropertyOptional({ example: 'ซอย 1', description: 'Optional; empty string allowed' })
  mem_alley?: string;

  @ApiPropertyOptional({ example: 'ถนนสุขุมวิท', description: 'Optional; empty string allowed' })
  mem_road?: string;

  @ApiProperty({ example: 'กรุงเทพมหานคร', description: 'Required; not empty' })
  mem_province: string;

  @ApiProperty({ example: 'บางนา', description: 'Required; not empty' })
  mem_amphur: string;

  @ApiProperty({ example: 'บางนา', description: 'Required; not empty' })
  mem_tumbon: string;

  @ApiProperty({ example: '10260', description: 'Required; not empty' })
  mem_post: string;

  @ApiProperty({ example: '0812345678', description: 'Required; not empty' })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'ฝากไว้กับยาม', description: 'Optional; empty string allowed' })
  Note?: string;

  @ApiPropertyOptional({ example: false, description: 'Optional; defaults to false' })
  defaults?: boolean;

  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;
}
