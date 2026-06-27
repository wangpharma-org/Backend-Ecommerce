import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty({ example: 'a1b2c3d4e5', description: 'Required; not empty' })
  session_token: string;

  @ApiPropertyOptional({ example: '203.0.113.10', description: 'Optional; empty string allowed' })
  ip_address?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0', description: 'Optional; empty string allowed' })
  user_agent?: string;

  @ApiPropertyOptional({ example: 'mobile', description: 'Optional; empty string allowed' })
  device_type?: string;
}

export class LogoutSessionDto {
  @ApiProperty({ example: 'a1b2c3d4e5', description: 'Required; not empty' })
  session_token: string;
}

export class MemCodeDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;
}
