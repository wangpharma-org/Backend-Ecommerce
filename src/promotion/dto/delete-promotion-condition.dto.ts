import { ApiProperty } from '@nestjs/swagger';

export class DeletePromotionConditionDto {
  @ApiProperty({ example: 7, description: 'Required' })
  cond_id: number;
}
