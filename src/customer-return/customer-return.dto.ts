import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ค่าเดียวกับ Order Picking (customer-return.enums.ts) — ถ้าแก้ต้องแก้ทั้งสองฝั่ง
export const RETURN_METHODS = ['exchange', 'refund', 'credit'] as const;
export const RETURN_REASONS = [
  'damaged',
  'expired',
  'near_expiry',
  'picking_error',
  'sales_error',
  'ordered_wrong_item',
  'ordered_wrong_qty',
  'over_delivered',
  'short_delivered',
  'other',
] as const;
export const RETURN_OUTCOMES = ['accepted', 'partial', 'rejected'] as const;
export const PICKUP_SLOTS = ['09:00-12:00', '13:00-17:00'] as const;

export class CreateReturnItemDto {
  @IsString()
  @MaxLength(50)
  pro_code: string;

  @IsInt()
  @Min(1)
  qty_return: number;

  @IsIn(RETURN_REASONS)
  reason: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @IsUrl({}, { each: true })
  customer_photos: string[];

  // LME — Order Picking บังคับ lot + วันหมดอายุ ยกเว้น "ได้รับไม่ครบ"
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lot_no?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mfg_date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  exp_date?: string;
}

// mem_code / ชื่อร้าน / ที่อยู่เข้ารับ ไม่รับจาก client — ดึงจาก JWT + ตาราง users เอง
export class CreateReturnDto {
  @IsString()
  @MaxLength(50)
  sh_running: string;

  // รูปแบบการคืนฝ่ายทำคืนเป็นผู้เลือก ลูกค้าไม่ได้เลือก
  // ไม่มีของให้รับ (ได้รับไม่ครบทุกรายการ) ไม่ต้องส่งวันเข้ารับ
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  pickup_date?: string;

  @IsOptional()
  @IsIn(PICKUP_SLOTS)
  pickup_slot?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note_to_driver?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateReturnItemDto)
  items: CreateReturnItemDto[];
}

export class ReturnCompletedDto {
  @IsString()
  @MaxLength(20)
  return_no: string;

  @IsString()
  @MaxLength(10)
  mem_code: string;

  // null เมื่อคืนไม่ได้ทั้งหมด
  @IsOptional()
  @IsIn(RETURN_METHODS)
  method?: string | null;

  @IsOptional()
  @IsIn(RETURN_OUTCOMES)
  outcome?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  receipt_doc_no?: string | null;

  @IsOptional()
  @IsNumber()
  receipt_net_total?: number | null;
}
