import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCustomerDataDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ example: 'ร้านยาตัวอย่าง', description: 'Required; not empty' })
  mem_nameSite: string;

  @ApiProperty({ example: 'pharmacy01', description: 'Required; not empty' })
  mem_username: string;

  @ApiProperty({ example: 'P@ssw0rd123', description: 'Required; not empty' })
  mem_password: string;

  @ApiProperty({ example: 'A', description: 'Required; not empty' })
  mem_price: string;

  @ApiProperty({ example: 'E001', description: 'Required; not empty' })
  emp_saleoffice: string;

  @ApiProperty({ example: '2026-06-01', description: 'Required; not empty' })
  latest_purchase: string;

  @ApiPropertyOptional({ example: 'E001', description: 'Optional; empty string allowed' })
  emp_id_ref?: string | null;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIs...', description: 'Required; not empty; refresh token' })
  token: string;
}
