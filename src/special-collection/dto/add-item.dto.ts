import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import {
  SPECIAL_COLLECTION_REF_TYPES,
  SpecialCollectionRefType,
} from '../special-collection-item.entity';

export class AddItemDto {
  @IsEnum(SPECIAL_COLLECTION_REF_TYPES, {
    message: `ref_type ต้องเป็นหนึ่งใน: ${SPECIAL_COLLECTION_REF_TYPES.join(', ')}`,
  })
  ref_type!: SpecialCollectionRefType;

  @IsString()
  @Length(1, 50, { message: 'ref_id ต้องไม่ว่าง' })
  ref_id!: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  title_override?: string;

  @IsOptional()
  @IsInt()
  @Min(0, { message: 'sort_order ต้องไม่ติดลบ' })
  sort_order?: number;
}
