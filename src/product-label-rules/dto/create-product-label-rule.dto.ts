import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { normalizeRequiredString } from './product-label-rule.validation';

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
  @IsBoolean()
  isActive?: boolean;
}
