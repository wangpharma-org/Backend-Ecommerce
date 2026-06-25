import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddFlashsaleDto {
  @ApiProperty({ example: 'Flash Sale วันศุกร์', description: 'Required; not empty' })
  promotion_name: string;

  @ApiProperty({ example: '2026-07-03', description: 'Required; not empty' })
  date: string;

  @ApiProperty({ example: '10:00', description: 'Required; not empty' })
  time_start: string;

  @ApiProperty({ example: '14:00', description: 'Required; not empty' })
  time_end: string;

  @ApiProperty({ example: true, description: 'Required' })
  is_active: boolean;
}

export class EditFlashsaleDto {
  @ApiProperty({ example: 3, description: 'Required' })
  promotion_id: number;

  @ApiProperty({ example: 'Flash Sale วันหยุด', description: 'Required; not empty' })
  promotion_name: string;

  @ApiProperty({ example: '2026-06-23', description: 'Required; format YYYY-MM-DD' })
  date: string;

  @ApiProperty({ example: '09:00', description: 'Required; format HH:mm' })
  time_start: string;

  @ApiProperty({ example: '21:00', description: 'Required; format HH:mm' })
  time_end: string;

  @ApiProperty({ example: true, description: 'Required' })
  is_active: boolean;
}

export class DeleteFlashsaleDto {
  @ApiProperty({ example: 3, description: 'Required' })
  id: number;
}

export class ChangeStatusFlashsaleDto {
  @ApiProperty({ example: 10, description: 'Required' })
  id: number;

  @ApiProperty({ example: true, description: 'Required' })
  is_active: boolean;
}

export class AddProductToFlashsaleDto {
  @ApiProperty({ example: 3, description: 'Required' })
  promotion_id: number;

  @ApiProperty({ example: 'P00123', description: 'Required; not empty' })
  pro_code: string;

  @ApiProperty({ example: 50, description: 'Required' })
  limit: number;
}

export class EditProductInFlashsaleDto {
  @ApiProperty({ example: 10, description: 'Required' })
  id: number;

  @ApiProperty({ example: 50, description: 'Required' })
  limit: number;
}

export class DeleteProductFlashsaleDto {
  @ApiProperty({ example: 10, description: 'Required' })
  id: number;
}

export class GetFlashsaleByDateDto {
  @ApiPropertyOptional({ example: 20, description: 'Optional; max items to return' })
  limit: number;

  @ApiPropertyOptional({ example: 'M00123', description: 'Optional; overridden by JWT mem_code if present' })
  mem_code: string;
}
