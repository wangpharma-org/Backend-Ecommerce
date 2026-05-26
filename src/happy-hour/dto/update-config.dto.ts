import { IsBoolean, IsDateString, IsOptional } from 'class-validator';

export class UpdateConfigDto {
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @IsOptional()
  @IsDateString()
  end_date?: string | null;
}
