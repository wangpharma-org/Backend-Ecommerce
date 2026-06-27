import { ApiProperty } from '@nestjs/swagger';

export class UpdateFlagDto {
  @ApiProperty({ example: 'new_checkout', description: 'Required' })
  flag: string;

  @ApiProperty({ example: true, description: 'Required' })
  status: boolean;
}
