import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

export class CreateSlotDto {
  @Matches(/^\d{2}:\d{2}$/, { message: 'start_time ต้องอยู่ในรูปแบบ HH:mm' })
  start_time!: string;

  @Matches(/^\d{2}:\d{2}$/, { message: 'end_time ต้องอยู่ในรูปแบบ HH:mm' })
  end_time!: string;

  @IsNumber()
  @Min(1, { message: 'min_order_amount ต้องมากกว่า 0' })
  min_order_amount!: number;

  @IsNumber()
  @Min(1, { message: 'card_value ต้องมากกว่า 0' })
  card_value!: number;

  @IsNumber()
  @Min(1, { message: 'excess_threshold ต้องมากกว่า 0' })
  excess_threshold!: number;

  @IsNumber()
  @Min(1, { message: 'discount_per_step ต้องมากกว่า 0' })
  discount_per_step!: number;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  reward_pro_code?: string;

  @IsOptional()
  @IsString()
  reward_unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(1, { message: 'reward_amount ต้องมากกว่า 0' })
  reward_amount?: number;
}
