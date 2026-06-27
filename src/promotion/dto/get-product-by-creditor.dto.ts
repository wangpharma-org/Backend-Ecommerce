import { ApiProperty } from '@nestjs/swagger';

export class GetProductByCreditorDto {
  @ApiProperty({ example: 'C001', description: 'Required; not empty' })
  creditor_code: string;
}
