import { ApiProperty } from '@nestjs/swagger';

export class ImportInvoiceBillItemDto {
  @ApiProperty({ example: '2026-06-23', description: 'Required; format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 'INV00123', description: 'Required; not empty' })
  invoice: string;

  @ApiProperty({ example: '500.00', description: 'Required; not empty' })
  price: string;

  @ApiProperty({ example: '', description: 'Optional; empty string allowed' })
  comments: string;
}

export class ImportDataInvoiceDto {
  @ApiProperty({ example: '2026-06-23', description: 'Required; format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 'INV00123', description: 'Required; not empty' })
  invoice: string;

  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ example: '2026-07-23', description: 'Required; format YYYY-MM-DD' })
  date_due: string;

  @ApiProperty({ example: '1000.00', description: 'Required; not empty' })
  total: string;

  @ApiProperty({ example: '500.00', description: 'Required; not empty' })
  payment: string;

  @ApiProperty({ example: '500.00', description: 'Required; not empty' })
  balance: string;

  @ApiProperty({ type: [ImportInvoiceBillItemDto] })
  bill_list: ImportInvoiceBillItemDto[];
}

export class ImportRtProductItemDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 'ยาพาราเซตามอล', description: 'Required; not empty' })
  pro_name: string;

  @ApiProperty({ example: '10', description: 'Required; not empty' })
  pro_amount: string;

  @ApiProperty({ example: 'กล่อง', description: 'Required; not empty' })
  pro_unit: string;

  @ApiProperty({ example: '5.00', description: 'Required; not empty' })
  pro_price_per_unit: string;

  @ApiProperty({ example: '0.00', description: 'Required; not empty' })
  pro_discount: string;
}

export class ImportDataRtDto {
  @ApiProperty({ example: 'INV00123', description: 'Required; not empty' })
  invoice: string;

  @ApiProperty({ example: '2026-06-23', description: 'Required; format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;

  @ApiProperty({ example: '10', description: 'Required; not empty' })
  pro_amount: string;

  @ApiProperty({ example: '50.00', description: 'Required; not empty' })
  dis_price: string;

  @ApiProperty({ example: '', description: 'Optional; empty string allowed' })
  comments: string;

  @ApiProperty({ type: [ImportRtProductItemDto] })
  pro_list: ImportRtProductItemDto[];
}
