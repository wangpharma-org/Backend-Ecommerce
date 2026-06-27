import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RequestOtpDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;
}

export class ValidateOtpDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_username: string;

  @ApiProperty({ example: '123456', description: 'Required; not empty' })
  otp: string;

  @ApiProperty({ example: '2026-06-23T10:00:00.000Z', description: 'Required; ISO datetime' })
  timeNow: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'NewP@ssw0rd', description: 'Required; not empty' })
  new_password: string;

  @ApiProperty({ example: 'OldP@ssw0rd', description: 'Required; not empty' })
  old_password: string;

  @ApiPropertyOptional({ example: false, description: 'Optional; defaults to false' })
  logout_all_devices?: boolean;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_username: string;

  @ApiProperty({ example: 'NewP@ssw0rd', description: 'Required; not empty' })
  new_password: string;

  @ApiProperty({ example: '123456', description: 'Required; not empty' })
  otp: string;
}
