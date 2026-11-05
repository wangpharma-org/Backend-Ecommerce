import { IsBoolean, IsInt, Min } from 'class-validator';

export class SetCreditorProductsConditionDto {
  @IsInt()
  @Min(1)
  tier_id!: number;

  // true = เพิ่มสินค้าทุกตัวของเจ้าหนี้, false = นำสินค้าของเจ้าหนี้ออกทั้งหมด
  @IsBoolean()
  status!: boolean;
}
