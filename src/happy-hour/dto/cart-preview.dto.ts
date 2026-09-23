import {
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CartItemDto {
  @IsString()
  pro_code!: string;

  @IsNumber()
  @Min(0)
  amount!: number;
}

export class CartPreviewDto {
  /** backend อ่านตะกร้าเองจาก token แล้ว ฟิลด์นี้เหลือไว้ให้ client เก่าส่งมาได้โดยไม่ 400 */
  @IsOptional()
  @IsNumber()
  @Min(0)
  order_amount?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cart_items?: CartItemDto[];
}
