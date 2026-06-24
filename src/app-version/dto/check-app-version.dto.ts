import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppPlatform } from '../app-version.entity';
import {
  APP_VERSION_PATTERN,
  normalizePlatform,
  trimString,
} from './app-version-validation';

export class CheckAppVersionDto {
  @ApiProperty({
    enum: AppPlatform,
    example: AppPlatform.ANDROID,
    description: 'Required; แพลตฟอร์มของแอป (android หรือ ios)',
  })
  @Transform(normalizePlatform)
  @IsEnum(AppPlatform)
  os!: AppPlatform;

  @ApiProperty({
    description: 'Required; not empty; เวอร์ชันปัจจุบันของแอปที่ client ใช้งานอยู่',
    example: '1.2.3',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Matches(APP_VERSION_PATTERN)
  version!: string;

  @ApiProperty({
    description: 'Required; not empty; หมายเลข build ของแอปที่ client ใช้งานอยู่',
    example: '123',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  buildNumber!: string;
}
