import { ApiProperty } from '@nestjs/swagger';

export class BackOfficeProductRowDto {
  @ApiProperty({ example: 'P00123', description: 'Required' })
  pro_code: string;

  @ApiProperty({ example: 'ยาพาราเซตามอล', description: 'Required' })
  pro_name: string;

  @ApiProperty({ example: 10, description: 'Required' })
  priceA: number;

  @ApiProperty({ example: 12, description: 'Required' })
  priceB: number;

  @ApiProperty({ example: 15, description: 'Required' })
  priceC: number;

  @ApiProperty({ example: 1, description: 'Required' })
  ratio1: number;

  @ApiProperty({ example: 10, description: 'Required' })
  ratio2: number;

  @ApiProperty({ example: 100, description: 'Required' })
  ratio3: number;

  @ApiProperty({ example: 'เม็ด', description: 'Required' })
  unit1: string;

  @ApiProperty({ example: 'แผง', description: 'Required' })
  unit2: string;

  @ApiProperty({ example: 'กล่อง', description: 'Required' })
  unit3: string;

  @ApiProperty({ example: 'S00123', description: 'Required' })
  supplier: string;

  @ApiProperty({ example: 5, description: 'Required' })
  pro_lowest_stock: number;

  @ApiProperty({ example: 100, description: 'Required' })
  order_quantity: number;
}

export class UpdateProductFromBackOfficeDto {
  @ApiProperty({
    type: [BackOfficeProductRowDto],
    description: 'Required; rows of product fields to update (pro_code, pro_name, prices, ratios, units, supplier, stock fields)',
  })
  group: BackOfficeProductRowDto[];

  @ApiProperty({ example: 'back-office-2026-06.xlsx', description: 'Required; not empty' })
  filename: string;
}

export class UpdateStockBackOfficeRowDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 100, description: 'Required' })
  stock: number;
}

export class UpdateStockFromBackOfficeDto {
  @ApiProperty({ type: [UpdateStockBackOfficeRowDto], description: 'Required' })
  group: UpdateStockBackOfficeRowDto[];

  @ApiProperty({ example: 'stock-2026-06.xlsx', description: 'Required; not empty' })
  filename: string;
}
