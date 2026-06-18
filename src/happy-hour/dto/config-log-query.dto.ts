import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfigLogQueryDto {
  /** กรองตาม action: UPDATE | TOGGLE */
  @ApiPropertyOptional({ description: 'กรองตาม action', enum: ['UPDATE', 'TOGGLE'] })
  @IsOptional()
  @IsIn(['UPDATE', 'TOGGLE'])
  action?: 'UPDATE' | 'TOGGLE';

  /** กรองตามผู้ดำเนินการ (บางส่วนก็ได้) */
  @ApiPropertyOptional({ description: 'กรองตามผู้ดำเนินการ (username, ค้นหาแบบบางส่วนได้)' })
  @IsOptional()
  @IsString()
  performed_by?: string;

  @ApiPropertyOptional({ description: 'หน้าที่ต้องการ (default 1)', type: Number, default: 1 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'จำนวนรายการต่อหน้า (default 20)',
    type: Number,
    default: 20,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
