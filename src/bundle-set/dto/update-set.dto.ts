import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class UpdateSetDto {
  @IsOptional()
  @IsString()
  @Length(1, 200, { message: 'set_name ต้องยาว 1–200 ตัวอักษร' })
  set_name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'ราคาชุดต้องไม่ติดลบ' })
  price?: number;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  image?: string;

  @IsOptional()
  @IsBoolean()
  status?: boolean;

  @IsOptional()
  @IsDateString({}, { message: 'start_date ต้องเป็นวันที่ที่ถูกต้อง' })
  start_date?: string | null;

  @IsOptional()
  @IsDateString({}, { message: 'end_date ต้องเป็นวันที่ที่ถูกต้อง' })
  end_date?: string | null;

  @IsOptional()
  @IsInt()
  promo_id?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
