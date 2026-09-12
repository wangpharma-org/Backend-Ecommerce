import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

export class AddSetItemDto {
  @IsString()
  @Length(1, 20)
  pro_code!: string;

  @IsIn([1, 2, 3], { message: 'unit_level ต้องเป็น 1, 2 หรือ 3' })
  unit_level!: number;

  @IsInt()
  @Min(1, { message: 'จำนวนต้องมากกว่า 0' })
  qty!: number;

  @IsOptional()
  @IsBoolean()
  is_gift?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number;
}
