import { ApiProperty } from '@nestjs/swagger';

export class TrackCompanyDayViewDto {
  @ApiProperty({ example: 5, description: 'Required' })
  promo_id: number;

  @ApiProperty({ example: 'Company Day มิถุนายน', description: 'Required; not empty' })
  promo_name: string;

  @ApiProperty({ example: 'Gold', description: 'Required; not empty' })
  tier: string;

  @ApiProperty({ example: 'banner', description: 'Required; not empty' })
  source: string;
}
