import { ApiProperty } from '@nestjs/swagger';

export class DeletePromotionRewardDto {
  @ApiProperty({ example: 9, description: 'Required' })
  reward_id: number;
}
