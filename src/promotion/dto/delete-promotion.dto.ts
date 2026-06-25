import { ApiProperty } from '@nestjs/swagger';

export class DeletePromotionDto {
  @ApiProperty({ example: 12, description: 'Required' })
  promo_id: number;
}
