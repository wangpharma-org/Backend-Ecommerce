import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class ReorderItemsDto {
  /** ลำดับใหม่ทั้งชุด — index ในอาร์เรย์คือ sort_order */
  @IsArray()
  @ArrayNotEmpty({ message: 'item_ids ต้องมีอย่างน้อย 1 รายการ' })
  @IsInt({ each: true, message: 'item_ids ต้องเป็นตัวเลขทั้งหมด' })
  item_ids!: number[];
}
