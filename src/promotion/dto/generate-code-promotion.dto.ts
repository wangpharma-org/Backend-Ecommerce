import { ApiProperty } from '@nestjs/swagger';

export class GenerateCodePromotionDto {
  @ApiProperty({ example: 'M00123', description: 'Required; not empty' })
  mem_code: string;
}
