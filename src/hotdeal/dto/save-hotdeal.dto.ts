import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HotdealInput } from '../hotdeal.service';

export class SaveHotdealDto {
  @ApiProperty({
    type: Object,
    description: 'Required; hotdeal input payload (pro_code, dates, discount, freebies, etc.)',
  })
  data: HotdealInput;

  @ApiPropertyOptional({ example: 5, description: 'Optional; omit to create, provide to update' })
  id?: number;

  @ApiPropertyOptional({ example: 1, description: 'Optional' })
  order?: number;

  @ApiPropertyOptional({ example: false, description: 'Optional' })
  special_deal?: boolean;
}
