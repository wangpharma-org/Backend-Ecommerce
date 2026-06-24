import { ApiProperty } from '@nestjs/swagger';

export class AddLotItemDto {
  @ApiProperty({ example: 'LOT2026A', description: 'Required; not empty' })
  lot: string;

  @ApiProperty({ example: '2026-01-01', description: 'Required; not empty' })
  mfg: string;

  @ApiProperty({ example: '2028-01-01', description: 'Required; not empty' })
  exp: string;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}
