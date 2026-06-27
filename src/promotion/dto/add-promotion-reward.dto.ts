import { ApiProperty } from '@nestjs/swagger';

export class AddPromotionRewardDto {
  @ApiProperty({ example: 5, description: 'Required' })
  tier_id: number;

  @ApiProperty({ example: 'G001', description: 'Required; not empty' })
  product_gcode: string;

  @ApiProperty({ example: 1, description: 'Required' })
  qty: number;

  @ApiProperty({ example: 'กล่อง', description: 'Required; not empty' })
  unit: string;
}
