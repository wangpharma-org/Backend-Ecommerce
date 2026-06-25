import { ApiProperty } from '@nestjs/swagger';

export class AddCreditorDto {
  @ApiProperty({ example: 'C001', description: 'Required; not empty' })
  creditor_code: string;

  @ApiProperty({ example: 'บริษัท ตัวอย่าง จำกัด', description: 'Required; not empty' })
  creditor_name: string;
}
