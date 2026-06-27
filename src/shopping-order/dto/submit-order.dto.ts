import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListFreeItemDto {
  @ApiProperty({ example: 'P00123' })
  pro_code: string;

  @ApiProperty({ example: 1 })
  amount: number;

  @ApiProperty({ example: 'กล่อง' })
  pro_unit1: string;

  @ApiProperty({ example: 10 })
  pro_point: number;

  @ApiProperty({ enum: ['1', '2', '3'], example: '1' })
  unit_enum: '1' | '2' | '3';
}

export class SubmitOrderDto {
  @ApiPropertyOptional({ example: 'E001', description: 'Optional; empty string allowed' })
  emp_code?: string;

  @ApiProperty({ example: 'M00123', description: 'Required, but overridden by JWT member code' })
  mem_code: string;

  @ApiProperty({ example: 1500.5, description: 'Required' })
  total_price: number;

  @ApiProperty({
    type: [ListFreeItemDto],
    nullable: true,
    description: 'Required; pass null if no point-redeemed free items',
  })
  listFree: [ListFreeItemDto] | null;

  @ApiProperty({ example: 'A', description: 'Required; not empty' })
  priceOption: string;

  @ApiProperty({ example: 'cash', description: 'Required; not empty' })
  paymentOptions: string;

  @ApiProperty({ example: 'standard', description: 'Required; not empty' })
  shippingOptions: string;

  @ApiProperty({ example: '123 ถ.สุขุมวิท กรุงเทพฯ', description: 'Required; not empty' })
  addressed: string;
}
