import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trimString = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpsertOrderBillNumberDto {
  /** เลขที่คำสั่งจอง — ใช้ชื่อ sh_running ตามฝั่ง order-picking */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  sh_running!: string;

  /** เลขบิล */
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  bill_number!: string;
}
