import { ApiProperty } from '@nestjs/swagger';

export class AddPromotionConditionDto {
  @ApiProperty({ example: 5, description: 'Required' })
  tier_id: number;

  @ApiProperty({ example: 'G001', description: 'Required; not empty' })
  product_gcode: string;
}
