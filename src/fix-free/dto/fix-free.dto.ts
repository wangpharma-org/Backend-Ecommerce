import { ApiProperty } from '@nestjs/swagger';

export class AddProductFreeDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 100, description: 'Required' })
  pro_point: number;
}

export class DeleteProductFreeDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}

export class EditProductFreeDto {
  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 150, description: 'Required' })
  pro_point: number;
}
