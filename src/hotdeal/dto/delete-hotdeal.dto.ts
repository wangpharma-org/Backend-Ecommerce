import { ApiProperty } from '@nestjs/swagger';

export class DeleteHotdealDto {
  @ApiProperty({ example: 5, description: 'Required' })
  id: number;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;
}
