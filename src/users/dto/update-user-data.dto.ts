import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateUserDataDto {
  @ApiProperty({
    example: 'M00001',
    description: 'Required; not empty; รหัสสมาชิกใช้ระบุตัวผู้ใช้ที่จะอัปเดต',
  })
  mem_code: string;

  @ApiPropertyOptional({ example: 'pharmacy01', description: 'Optional; empty string allowed' })
  mem_username?: string;

  @ApiPropertyOptional({ example: 'ร้านยาสุขภาพดี', description: 'Optional; empty string allowed' })
  mem_nameSite?: string;

  @ApiPropertyOptional({ example: 'ภ.12345', description: 'Optional; empty string allowed' })
  mem_license?: string;

  @ApiPropertyOptional({ example: '0812345678', description: 'Optional; empty string allowed' })
  mem_phone?: string;

  @ApiPropertyOptional({ example: 'pharmacy01@example.com', description: 'Optional; empty string allowed' })
  mem_email?: string;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Optional; empty string allowed' })
  mem_taxid?: string;

  @ApiPropertyOptional({ example: '123 หมู่ 4', description: 'Optional; empty string allowed' })
  mem_address?: string;

  @ApiPropertyOptional({ example: 'หมู่บ้านสุขใจ', description: 'Optional; empty string allowed' })
  mem_village?: string;

  @ApiPropertyOptional({ example: 'ซอย 5', description: 'Optional; empty string allowed' })
  mem_alley?: string;

  @ApiPropertyOptional({ example: 'ถนนสุขุมวิท', description: 'Optional; empty string allowed' })
  mem_road?: string;

  @ApiPropertyOptional({ example: 'กรุงเทพมหานคร', description: 'Optional; empty string allowed' })
  mem_province?: string;

  @ApiPropertyOptional({ example: 'วัฒนา', description: 'Optional; empty string allowed' })
  mem_amphur?: string;

  @ApiPropertyOptional({ example: 'คลองเตยเหนือ', description: 'Optional; empty string allowed' })
  mem_tumbon?: string;

  @ApiPropertyOptional({ example: '10110', description: 'Optional; empty string allowed' })
  mem_post?: string;

  @ApiPropertyOptional({ example: 'company', description: 'Optional; empty string allowed' })
  mem_invoice_type?: string;

  @ApiPropertyOptional({
    example: 'U1234567890abcdef1234567890abcdef',
    description: 'Optional; empty string allowed',
  })
  line_id?: string;

  @ApiPropertyOptional({ example: 'https://wangpharma.com', description: 'Optional; empty string allowed' })
  website?: string;

  @ApiPropertyOptional({
    example: 'https://facebook.com/wangpharma',
    description: 'Optional; empty string allowed',
  })
  facebook?: string;

  @ApiPropertyOptional({ example: 'นาย', description: 'Optional; empty string allowed' })
  owner_title?: string;

  @ApiPropertyOptional({ example: 'สมชาย ใจดี', description: 'Optional; empty string allowed' })
  owner_name?: string;

  @ApiPropertyOptional({ example: '0812345678', description: 'Optional; empty string allowed' })
  owner_tel?: string;

  @ApiPropertyOptional({ example: 'owner@example.com', description: 'Optional; empty string allowed' })
  owner_email?: string;

  @ApiPropertyOptional({ example: 'ภญ.', description: 'Optional; empty string allowed' })
  pharmacist_title?: string;

  @ApiPropertyOptional({ example: 'สมหญิง ขยันดี', description: 'Optional; empty string allowed' })
  pharmacist_name?: string;

  @ApiPropertyOptional({ example: '0823456789', description: 'Optional; empty string allowed' })
  pharmacist_tel?: string;

  @ApiPropertyOptional({ example: 'pharmacist@example.com', description: 'Optional; empty string allowed' })
  pharmacist_email?: string;
}
