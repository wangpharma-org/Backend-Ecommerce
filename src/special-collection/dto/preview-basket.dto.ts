import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { BasketLineDto } from './create-basket.dto';

/**
 * กระเช้าที่ลูกค้ากำลังประกอบ ยังไม่ได้ใส่ตะกร้า
 * ว่างได้ (ลบของออกหมด) — ตอบกลับว่ายังไม่ได้ของแถมอะไร ไม่ใช่ error
 */
export class PreviewBasketDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BasketLineDto)
  lines?: BasketLineDto[];
}
