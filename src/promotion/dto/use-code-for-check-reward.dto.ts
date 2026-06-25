import { ApiProperty } from '@nestjs/swagger';

export class UseCodeForCheckRewardDto {
  @ApiProperty({ example: 'PROMO2026', description: 'Required; not empty' })
  code_text: string;
}
