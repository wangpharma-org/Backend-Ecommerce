import { ApiProperty } from '@nestjs/swagger';

export class UpdatePromotionStatusDto {
  @ApiProperty({ example: 12, description: 'Required' })
  promo_id: number;

  @ApiProperty({ example: true, description: 'Required' })
  status: boolean;
}
