import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';
import { AppPlatform } from '../app-version.entity';
import {
  APP_VERSION_PATTERN,
  normalizePlatform,
  trimString,
} from './app-version-validation';

export class LegacyCheckAppVersionDto {
  @Transform(normalizePlatform)
  @IsEnum(AppPlatform)
  os: AppPlatform;

  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @Matches(APP_VERSION_PATTERN)
  version: string;
}
