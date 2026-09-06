import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';

export class BasketLineDto {
  @IsString()
  @Length(1, 20)
  pro_code!: string;

  @IsIn([1, 2, 3], { message: 'unit_level ต้องเป็น 1, 2 หรือ 3' })
  unit_level!: number;

  @IsInt()
  @Min(1, { message: 'จำนวนต้องมากกว่า 0' })
  qty!: number;
}

export class CreateBasketDto {
  @IsInt()
  @Min(1, { message: 'promo_id ต้องเป็นตัวเลขจำนวนเต็มบวก' })
  promo_id!: number;

  @IsArray()
  @ArrayNotEmpty({ message: 'กระเช้าต้องมีสินค้าอย่างน้อย 1 รายการ' })
  @ValidateNested({ each: true })
  @Type(() => BasketLineDto)
  lines!: BasketLineDto[];
}
