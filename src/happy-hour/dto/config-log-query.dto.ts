import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class ConfigLogQueryDto {
  /** กรองตาม action: UPDATE | TOGGLE */
  @IsOptional()
  @IsIn(['UPDATE', 'TOGGLE'])
  action?: 'UPDATE' | 'TOGGLE';

  /** กรองตามผู้ดำเนินการ (บางส่วนก็ได้) */
  @IsOptional()
  @IsString()
  performed_by?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
