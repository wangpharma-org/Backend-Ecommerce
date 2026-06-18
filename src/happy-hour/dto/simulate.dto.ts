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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderItemDto {
  @ApiProperty({ description: 'รหัสสินค้า' })
  @IsString()
  pro_code!: string;

  @ApiProperty({ description: 'จำนวน/ยอดของสินค้านี้ ต้องไม่ติดลบ' })
  @IsNumber()
  @Min(0, { message: 'amount ต้องไม่ติดลบ' })
  amount!: number;

  /** vendor_code ของสินค้า — ใช้สำหรับ min_order_scope = 'vendor' */
  @ApiPropertyOptional({
    description: "vendor_code ของสินค้า — ใช้สำหรับ min_order_scope = 'vendor'",
  })
  @IsOptional()
  @IsString()
  vendor_code?: string;
}

export class SimulateDto {
  @ApiProperty({ description: 'ยอดสั่งซื้อรวม ต้องไม่ติดลบ' })
  @IsNumber()
  @Min(0, { message: 'order_amount ต้องไม่ติดลบ' })
  order_amount!: number;

  @ApiProperty({
    description: 'เวลาสั่งซื้อที่ต้องการจำลอง รูปแบบ HH:mm (00:00–23:59)',
    example: '10:30',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'order_time ต้องอยู่ในรูปแบบ HH:mm (00:00–23:59)',
  })
  order_time!: string;

  /**
   * รายการสินค้าในคำสั่งซื้อ — ใช้สำหรับ min_order_scope = 'specific'
   * ถ้าไม่ส่ง จะใช้ order_amount ทั้งหมดในการเทียบ min_order_amount
   */
  @ApiPropertyOptional({
    description:
      "รายการสินค้าในคำสั่งซื้อ — ใช้สำหรับ min_order_scope = 'specific'. ถ้าไม่ส่ง จะใช้ order_amount ทั้งหมดในการเทียบ min_order_amount",
    type: [OrderItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  order_items?: OrderItemDto[];
}
