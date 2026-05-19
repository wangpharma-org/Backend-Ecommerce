import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

export enum AdminNotificationChannel {
  FCM = 'FCM',
  LINE = 'LINE',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum AdminNotificationTargetMode {
  SINGLE = 'single',
  BROADCAST = 'broadcast',
  SEGMENT = 'segment',
}

const trimString = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  return value.trim();
};

const emptyStringToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

const normalizeStringArray = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item !== '');

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

const normalizePriceGroups = ({ value }: { value: unknown }) => {
  if (!Array.isArray(value)) {
    return value;
  }

  const normalized = value
    .map((item) =>
      typeof item === 'string' ? item.trim().toUpperCase() : '',
    )
    .filter((item) => item !== '');

  return normalized.length > 0 ? Array.from(new Set(normalized)) : undefined;
};

export class AdminNotificationFilterDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(normalizeStringArray)
  provinces?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @Transform(normalizePriceGroups)
  priceGroups?: string[];
}

export class SendAdminNotificationDto {
  @IsOptional()
  @IsString()
  @Transform(trimString)
  @Transform(emptyStringToUndefined)
  memCode?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phoneNumber must be in E.164 format, e.g. +66812345678',
  })
  @Transform(trimString)
  @Transform(emptyStringToUndefined)
  phoneNumber?: string;

  @IsOptional()
  @IsBoolean()
  broadcast?: boolean;

  @IsOptional()
  @IsEnum(AdminNotificationTargetMode)
  targetMode?: AdminNotificationTargetMode;

  @IsOptional()
  @IsString()
  @Transform(trimString)
  @Transform(emptyStringToUndefined)
  type?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  title!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  message!: string;

  @IsOptional()
  @IsArray()
  @IsEnum(AdminNotificationChannel, { each: true })
  channels?: AdminNotificationChannel[];

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdminNotificationFilterDto)
  filter?: AdminNotificationFilterDto;
}
