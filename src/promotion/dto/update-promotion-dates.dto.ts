import { IsDateString, IsInt, IsString, Matches, Min } from 'class-validator';

export class UpdatePromotionDatesDto {
  @IsInt()
  @Min(1)
  promo_id!: number;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  start_date!: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  end_date!: string;
}
