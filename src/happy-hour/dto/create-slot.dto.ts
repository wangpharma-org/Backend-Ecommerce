import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RewardType, MinOrderScope } from '../happy-hour-slot.entity';

export class CreateSlotDto {
  @ApiProperty({
    description: 'เวลาเริ่มต้นของ slot รูปแบบ HH:mm (00:00–23:59)',
    example: '09:00',
  })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time ต้องอยู่ในรูปแบบ HH:mm (00:00–23:59)',
  })
  start_time!: string;

  @ApiProperty({
    description: 'เวลาสิ้นสุดของ slot รูปแบบ HH:mm (00:00–24:00)',
    example: '12:00',
  })
  @Matches(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, {
    message: 'end_time ต้องอยู่ในรูปแบบ HH:mm (00:00–24:00)',
  })
  end_time!: string;

  @ApiProperty({ description: 'ยอดสั่งซื้อขั้นต่ำที่ต้องถึงเพื่อรับสิทธิ์ (ต้องมากกว่า 0)' })
  @IsNumber()
  @Min(1, { message: 'min_order_amount ต้องมากกว่า 0' })
  min_order_amount!: number;

  @ApiPropertyOptional({ description: 'มูลค่าบัตร (card_value) สำหรับ reward แบบ card' })
  @IsOptional()
  @IsNumber()
  card_value!: number;

  @ApiPropertyOptional({ description: 'เกณฑ์ส่วนเกิน (excess_threshold) ต้องไม่ติดลบ' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'excess_threshold ต้องไม่ติดลบ' })
  excess_threshold?: number;

  @ApiPropertyOptional({ description: 'ส่วนลดต่อขั้น (discount_per_step) ต้องไม่ติดลบ' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'discount_per_step ต้องไม่ติดลบ' })
  discount_per_step?: number;

  @ApiPropertyOptional({ description: 'สถานะเปิดใช้งาน slot นี้หรือไม่' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'รหัสสินค้าที่เป็นของแถม (reward) สำหรับ slot นี้',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reward_pro_codes?: string[];

  @ApiPropertyOptional({
    description: 'จำนวนของแถมที่สัมพันธ์กับ reward_pro_codes แต่ละตัว',
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  reward_amounts?: number[];

  @ApiPropertyOptional({ description: 'จำนวนของแถม (ต้องมากกว่า 0)' })
  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'reward_amount ต้องมากกว่า 0' })
  reward_amount?: number;

  @ApiPropertyOptional({
    description: 'วันที่เริ่มต้นโปรโมชั่น (ISO date string) หรือ null',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  promo_start_date?: string | null;

  @ApiPropertyOptional({
    description: 'วันที่สิ้นสุดโปรโมชั่น (ISO date string) หรือ null',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  promo_end_date?: string | null;

  @ApiPropertyOptional({
    description: 'ประเภทของรางวัล',
    enum: ['card', 'bill_discount'],
  })
  @IsOptional()
  @IsEnum(['card', 'bill_discount'], { message: 'reward_type ต้องเป็น card หรือ bill_discount' })
  reward_type?: RewardType;

  @ApiPropertyOptional({ description: 'มูลค่ารางวัล (reward_value) ต้องไม่ติดลบ' })
  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'reward_value ต้องไม่ติดลบ' })
  reward_value?: number;

  @ApiPropertyOptional({
    description: 'ขอบเขตการคำนวณยอดสั่งซื้อขั้นต่ำ',
    enum: ['all', 'specific', 'vendor'],
  })
  @IsOptional()
  @IsEnum(['all', 'specific', 'vendor'], { message: 'min_order_scope ต้องเป็น all, specific หรือ vendor' })
  min_order_scope?: MinOrderScope;

  @ApiPropertyOptional({
    description: 'รหัสสินค้าที่ใช้นับยอดขั้นต่ำเมื่อ min_order_scope = specific',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  min_order_pro_codes?: string[];

  @ApiPropertyOptional({
    description: 'รหัสเจ้าหนี้/vendor ที่ใช้นับยอดขั้นต่ำเมื่อ min_order_scope = vendor',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  min_order_vendor_code?: string | null;
}
