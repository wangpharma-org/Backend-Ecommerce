import { ApiProperty } from '@nestjs/swagger';

export class ImportWangdayDto {
  @ApiProperty({
    type: [Object],
    description:
      'Required; rows from Excel with Thai column keys (วันที่, เลขที่ใบกำกับ, รหัสลูกค้า, ยอดเงินสุทธิ)',
  })
  data: Record<string, unknown>[];

  @ApiProperty({ example: true, description: 'Required' })
  isLastChunk: boolean;

  @ApiProperty({ example: false, description: 'Required' })
  isFirstChunk: boolean;

  @ApiProperty({ example: 'wangday-2026-06.xlsx', description: 'Required; not empty' })
  fileName: string;
}
