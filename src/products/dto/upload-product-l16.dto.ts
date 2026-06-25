import { ApiProperty } from '@nestjs/swagger';

export class ProductL16ItemDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({
    oneOf: [{ type: 'number' }, { type: 'string' }],
    example: 1,
    description: 'Required; 1 = L16-only, 0 = normal',
  })
  status: number | string;
}

export class UploadProductL16Dto {
  @ApiProperty({ type: [ProductL16ItemDto], description: 'Required' })
  data: ProductL16ItemDto[];

  @ApiProperty({ example: 'l16-upload-2026-06.xlsx', description: 'Required; not empty' })
  filename: string;
}
