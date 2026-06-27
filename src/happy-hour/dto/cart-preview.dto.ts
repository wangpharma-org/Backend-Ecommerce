import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CartItemDto {
  @ApiProperty({ description: 'Required; not empty; รหัสสินค้า', example: 'A001' })
  @IsString()
  pro_code!: string;

  @ApiProperty({
    description: 'Required; จำนวนสินค้าในตะกร้า ต้องไม่ติดลบ',
    example: 5,
  })
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CartPreviewDto {
  @ApiProperty({
    description: 'Required; ยอดสั่งซื้อรวมในตะกร้า ต้องไม่ติดลบ',
    example: 1500,
  })
  @IsNumber()
  @Min(0)
  order_amount!: number;

  @ApiPropertyOptional({
    description: 'Optional; รายการสินค้าในตะกร้า — ใช้คำนวณ scope filtering ของ Happy Hour',
    type: [CartItemDto],
    example: [{ pro_code: 'A001', amount: 5 }],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cart_items?: CartItemDto[];
}
