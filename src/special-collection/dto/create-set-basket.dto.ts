import { IsInt, IsString, Length, Min } from 'class-validator';

export class CreateSetBasketDto {
  @IsString()
  @Length(1, 30)
  set_code!: string;

  @IsInt()
  @Min(1, { message: 'จำนวนชุดต้องมากกว่า 0' })
  qty!: number;
}
