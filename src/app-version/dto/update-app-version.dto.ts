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
import { AppPlatform } from '../app-version.entity';
import {
  APP_VERSION_PATTERN,
  normalizeOptionalString,
  normalizePlatform,
  trimString,
} from './app-version-validation';

export class UpdateAppVersionDto {
  @Transform(normalizePlatform)
  @IsOptional()
  @IsEnum(AppPlatform)
  platform?: AppPlatform;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @Matches(APP_VERSION_PATTERN)
  version?: string;

  @Transform(normalizeOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  message?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @IsUrl({
    protocols: ['http', 'https'],
    require_protocol: true,
  })
  storeUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
