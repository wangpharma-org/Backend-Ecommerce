import { ApiProperty } from '@nestjs/swagger';

export class DeleteTierDto {
  @ApiProperty({ example: 5, description: 'Required' })
  tier_id: number;
}
