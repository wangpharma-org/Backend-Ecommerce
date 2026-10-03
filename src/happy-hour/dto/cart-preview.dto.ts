import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  ValidateIf,
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
  @ValidateIf((dto: CartPreviewDto) => dto.basket_id !== undefined)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  basket_id?: number;

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
