import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConfigLogQueryDto {
  /** กรองตาม action: UPDATE | TOGGLE */
  @ApiPropertyOptional({
    description: 'Optional; กรองตาม action',
    enum: ['UPDATE', 'TOGGLE'],
    example: 'TOGGLE',
  })
  @IsOptional()
  @IsIn(['UPDATE', 'TOGGLE'])
  action?: 'UPDATE' | 'TOGGLE';

  /** กรองตามผู้ดำเนินการ (บางส่วนก็ได้) */
  @ApiPropertyOptional({
    description: 'Optional; กรองตามผู้ดำเนินการ (username, ค้นหาแบบบางส่วนได้)',
    example: 'admin01',
  })
  @IsOptional()
  @IsString()
  performed_by?: string;

  @ApiPropertyOptional({
    description: 'Optional; defaults to 1; หน้าที่ต้องการ',
    type: Number,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Optional; defaults to 20; จำนวนรายการต่อหน้า',
    type: Number,
    default: 20,
    example: 20,
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
