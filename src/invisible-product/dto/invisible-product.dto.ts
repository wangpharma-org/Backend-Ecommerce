import { ApiProperty } from '@nestjs/swagger';

export class AddInvisibleTopicDto {
  @ApiProperty({ example: 'ซ่อนสินค้าโปรโมชั่น', description: 'Required; not empty' })
  invisible_name: string;

  @ApiProperty({ example: '2026-12-31', description: 'Required; format YYYY-MM-DD' })
  date_end: string;

  @ApiProperty({ example: 'C00123', description: 'Required; not empty' })
  creditor_code: string;
}

export class AddInvisibleProductDto {
  @ApiProperty({ example: 1, description: 'Required' })
  invisible_id: number;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}

export class DeleteInvisibleProductDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}

export class DeleteInvisibleTopicDto {
  @ApiProperty({ example: '1', description: 'Required; not empty' })
  invisible_id: string;
}
