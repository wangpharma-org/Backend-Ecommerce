import { ApiProperty } from '@nestjs/swagger';

export class UpdatePromoPosterDto {
  @ApiProperty({ type: 'string', format: 'binary', description: 'Required' })
  file: unknown;

  @ApiProperty({ example: '12', description: 'Required; not empty' })
  promo_id: string;
}
