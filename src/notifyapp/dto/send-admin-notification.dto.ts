import { Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export enum AdminNotificationChannel {
  FCM = 'FCM',
  LINE = 'LINE',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
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
  @IsString()
  @Transform(trimString)
  @Transform(emptyStringToUndefined)
  type?: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  title: string;

  @IsString()
  @IsNotEmpty()
  @Transform(trimString)
  message: string;

  @IsOptional()
  @IsArray()
  @IsEnum(AdminNotificationChannel, { each: true })
  channels?: AdminNotificationChannel[];

  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;
}
