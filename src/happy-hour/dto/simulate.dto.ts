import { IsNumber, Matches, Min } from 'class-validator';

export class SimulateDto {
  @IsNumber()
  @Min(0, { message: 'order_amount ต้องไม่ติดลบ' })
  order_amount!: number;

  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, {
    message: 'order_time ต้องอยู่ในรูปแบบ HH:mm (00:00–23:59)',
  })
  order_time!: string;
}
