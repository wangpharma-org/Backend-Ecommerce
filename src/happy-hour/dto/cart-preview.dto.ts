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
  @ApiProperty({ description: 'รหัสสินค้า' })
  @IsString()
  pro_code!: string;

  @ApiProperty({ description: 'จำนวนสินค้าในตะกร้า ต้องไม่ติดลบ' })
  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CartPreviewDto {
  @ApiProperty({ description: 'ยอดสั่งซื้อรวมในตะกร้า ต้องไม่ติดลบ' })
  @IsNumber()
  @Min(0)
  order_amount!: number;

  @ApiPropertyOptional({
    description: 'รายการสินค้าในตะกร้า — ใช้คำนวณ scope filtering ของ Happy Hour',
    type: [CartItemDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cart_items?: CartItemDto[];
}
