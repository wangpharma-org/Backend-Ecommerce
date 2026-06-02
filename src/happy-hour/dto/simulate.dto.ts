import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class OrderItemDto {
  @IsString()
  pro_code!: string;

  @IsNumber()
  @Min(0, { message: 'amount ต้องไม่ติดลบ' })
  amount!: number;

  /** vendor_code ของสินค้า — ใช้สำหรับ min_order_scope = 'vendor' */
  @IsOptional()
  @IsString()
  vendor_code?: string;
}

export class SimulateDto {
  @IsNumber()
  @Min(0, { message: 'order_amount ต้องไม่ติดลบ' })
  order_amount!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'order_time ต้องอยู่ในรูปแบบ HH:mm (00:00–23:59)',
  })
  order_time!: string;

  /**
   * รายการสินค้าในคำสั่งซื้อ — ใช้สำหรับ min_order_scope = 'specific'
   * ถ้าไม่ส่ง จะใช้ order_amount ทั้งหมดในการเทียบ min_order_amount
   */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  order_items?: OrderItemDto[];
}
