import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiPropertyOptional({ description: 'เปิด/ปิดใช้งาน Happy Hour' })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'วันที่เริ่มต้นของ Happy Hour (ISO date string) หรือ null',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @ApiPropertyOptional({
    description: 'วันที่สิ้นสุดของ Happy Hour (ISO date string) หรือ null',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  end_date?: string | null;
}
