import { IsBoolean, IsDateString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateConfigDto {
  @ApiPropertyOptional({
    description: 'Optional; เปิด/ปิดใช้งาน Happy Hour',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Optional; nullable; วันที่เริ่มต้นของ Happy Hour (ISO date string) หรือ null',
    example: '2026-06-01T00:00:00.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  start_date?: string | null;

  @ApiPropertyOptional({
    description: 'Optional; nullable; วันที่สิ้นสุดของ Happy Hour (ISO date string) หรือ null',
    example: '2026-06-30T23:59:59.000Z',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  end_date?: string | null;
}
