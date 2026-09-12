import { IsArray, IsString } from 'class-validator';

export class SetAudienceDto {
  /** แทนที่รายชื่อร้านทั้งชุด — ส่งอาร์เรย์ว่างเพื่อล้างทั้งหมด */
  @IsArray()
  @IsString({ each: true, message: 'mem_codes ต้องเป็นข้อความทั้งหมด' })
  mem_codes!: string[];
}
