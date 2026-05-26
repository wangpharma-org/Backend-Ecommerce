import { IsInt, IsIn, IsOptional, IsString, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class SlotLogQueryDto {
  /** กรองตาม action: CREATE | UPDATE | DELETE */
  @IsOptional()
  @IsIn(['CREATE', 'UPDATE', 'DELETE'])
  action?: 'CREATE' | 'UPDATE' | 'DELETE';

  /** กรองตาม slot_id */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  @IsInt()
  @Min(1)
  slot_id?: number;

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
