import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AppPlatform } from '../app-version.entity';
import {
  APP_VERSION_PATTERN,
  normalizeOptionalString,
  normalizePlatform,
  trimString,
} from './app-version-validation';

export class UpdateAppVersionDto {
  @ApiPropertyOptional({
    enum: AppPlatform,
    example: AppPlatform.ANDROID,
    description: 'Optional; แพลตฟอร์มของแอป (android หรือ ios) ที่ต้องการแก้ไข',
  })
  @Transform(normalizePlatform)
  @IsOptional()
  @IsEnum(AppPlatform)
  platform?: AppPlatform;

  @ApiPropertyOptional({
    description: 'Optional; เวอร์ชันของแอปที่ต้องการ block/บังคับอัปเดต',
    example: '1.0.0',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(APP_VERSION_PATTERN)
  version?: string;

  @ApiPropertyOptional({
    description: 'Optional; empty string allowed; ข้อความที่จะแสดงให้ผู้ใช้เห็นเมื่อเวอร์ชันถูก block',
    example: 'เวอร์ชันนี้ไม่รองรับ กรุณาอัปเดตแอป',
    maxLength: 500,
  })
  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @ApiPropertyOptional({
    description: 'Optional; URL ของ store ให้ผู้ใช้ไปอัปเดตแอป',
    example: 'https://play.google.com/store/apps/details?id=com.example.app',
  })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  storeUrl?: string;

  @ApiPropertyOptional({
    description: 'Optional; สถานะการเปิดใช้งาน entry นี้',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
