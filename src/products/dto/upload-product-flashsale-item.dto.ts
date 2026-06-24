import { ApiProperty } from '@nestjs/swagger';

export class UploadProductFlashSaleItemDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  productCode: string;

  @ApiProperty({ example: 50, description: 'Required' })
  quantity: number;
}
