import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizeRequiredString } from './product-label-rule.validation';
import { ProductLabelMatchType } from '../product-label-match-type';

export class CreateProductLabelRuleDto {
  @Transform(normalizeRequiredString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label!: string;

  @Transform(normalizeRequiredString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  keyword!: string;

  @IsOptional()
  @IsEnum(ProductLabelMatchType)
  matchType?: ProductLabelMatchType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
