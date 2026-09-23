import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpsertDhlTrackingDto {
  /** เลขที่คำสั่งจองจาก shopping_head.soh_running */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  soh_running!: string;

  /** หมายเลขพัสดุ DHL */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  tracking_number!: string;
}
