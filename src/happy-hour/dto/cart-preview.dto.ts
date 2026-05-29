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
  @IsNumber()
  @Min(0)
  order_amount!: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CartItemDto)
  cart_items?: CartItemDto[];
}
