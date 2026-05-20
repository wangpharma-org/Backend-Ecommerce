import { IsNumber, Matches, Min } from 'class-validator';

export class SimulateDto {
  @IsNumber()
  @Min(0, { message: 'order_amount ต้องไม่ติดลบ' })
  order_amount!: number;

  @Matches(/^\d{2}:\d{2}$/, { message: 'order_time ต้องอยู่ในรูปแบบ HH:mm' })
  order_time!: string;
}
