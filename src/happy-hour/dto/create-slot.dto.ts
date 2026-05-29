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
import { RewardType, MinOrderScope } from '../happy-hour-slot.entity';

export class CreateSlotDto {
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'start_time ต้องอยู่ในรูปแบบ HH:mm (00:00–23:59)',
  })
  start_time!: string;

  @Matches(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, {
    message: 'end_time ต้องอยู่ในรูปแบบ HH:mm (00:00–24:00)',
  })
  end_time!: string;

  @IsNumber()
  @Min(1, { message: 'min_order_amount ต้องมากกว่า 0' })
  min_order_amount!: number;

  @IsOptional()
  @IsNumber()
  card_value!: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'excess_threshold ต้องไม่ติดลบ' })
  excess_threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'discount_per_step ต้องไม่ติดลบ' })
  discount_per_step?: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  reward_pro_codes?: string[];

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  reward_amounts?: number[];

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'reward_amount ต้องมากกว่า 0' })
  reward_amount?: number;

  @IsOptional()
  @IsDateString()
  promo_start_date?: string | null;

  @IsOptional()
  @IsDateString()
  promo_end_date?: string | null;

  @IsOptional()
  @IsEnum(['card', 'bill_discount'], { message: 'reward_type ต้องเป็น card หรือ bill_discount' })
  reward_type?: RewardType;

  @IsOptional()
  @IsNumber()
  @Min(0, { message: 'reward_value ต้องไม่ติดลบ' })
  reward_value?: number;

  @IsOptional()
  @IsEnum(['all', 'specific', 'vendor'], { message: 'min_order_scope ต้องเป็น all, specific หรือ vendor' })
  min_order_scope?: MinOrderScope;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  min_order_pro_codes?: string[];

  @IsOptional()
  @IsString()
  min_order_vendor_code?: string | null;
}
