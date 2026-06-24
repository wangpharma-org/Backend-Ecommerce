import { ApiProperty } from '@nestjs/swagger';

export class EditPromotionRewardDto {
  @ApiProperty({ example: 9, description: 'Required' })
  reward_id: number;

  @ApiProperty({ example: 2, description: 'Required' })
  qty: number;

  @ApiProperty({ example: 'กล่อง', description: 'Required; not empty' })
  unit: string;
}
