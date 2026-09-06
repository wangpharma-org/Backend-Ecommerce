import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { SpecialCollectionAudienceScope } from '../special-collection.entity';

export class CreateCollectionDto {
  @IsString()
  @Length(1, 200, { message: 'name ต้องยาว 1–200 ตัวอักษร' })
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'start_date ต้องเป็นวันที่ที่ถูกต้อง' })
  start_date?: string;

  @IsOptional()
  @IsDateString({}, { message: 'end_date ต้องเป็นวันที่ที่ถูกต้อง' })
  end_date?: string;

  @IsOptional()
  @IsEnum(['all', 'selected'], {
    message: "audience_scope ต้องเป็น 'all' หรือ 'selected'",
  })
  audience_scope?: SpecialCollectionAudienceScope;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'sort_order ต้องไม่ติดลบ' })
  sort_order?: number;

  /** ใส่มาพร้อมกันได้เลย — ใช้เมื่อ audience_scope = 'selected' */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  mem_codes?: string[];
}
