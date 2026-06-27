import { ApiProperty } from '@nestjs/swagger';

export class NewArrivalItemDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 'L2026001', description: 'Required; not empty' })
  LOT: string;

  @ApiProperty({ example: '2026-01-01', description: 'Required; format YYYY-MM-DD' })
  MFG: string;

  @ApiProperty({ example: '2028-01-01', description: 'Required; format YYYY-MM-DD' })
  EXP: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-06-23T10:00:00.000Z', description: 'Required; ISO datetime' })
  createdAt: Date;

  @ApiProperty({ example: 100, description: 'Required' })
  amount: number;

  @ApiProperty({ example: 'กล่อง', description: 'Required; not empty' })
  unit: string;
}
