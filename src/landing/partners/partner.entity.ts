import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'landing_partners' })
export class PartnerEntity {
  @ApiProperty({ description: 'รหัสของพาร์ทเนอร์', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ชื่อพาร์ทเนอร์', example: 'บริษัท ตัวอย่าง จำกัด' })
  @Column({ length: 200 })
  name: string;

  @ApiPropertyOptional({ description: 'URL โลโก้พาร์ทเนอร์', example: 'https://example.com/logo.png' })
  @Column({ length: 500, nullable: true })
  logo_url: string;

  @ApiPropertyOptional({ description: 'URL เว็บไซต์พาร์ทเนอร์', example: 'https://example.com' })
  @Column({ length: 500, nullable: true })
  website: string;

  @ApiPropertyOptional({ description: 'คำอธิบายพาร์ทเนอร์', example: 'พาร์ทเนอร์ผู้จัดจำหน่ายยา' })
  @Column({ type: 'text', nullable: true })
  description: string;

  @ApiPropertyOptional({ description: 'หมวดหมู่พาร์ทเนอร์', example: 'ผู้จัดจำหน่าย' })
  @Column({ length: 100, nullable: true })
  category: string;

  @ApiPropertyOptional({
    description: 'รายการรหัสเจ้าหนี้ (creditor codes) ที่เกี่ยวข้อง',
    type: [String],
    nullable: true,
    example: ['C001', 'C002'],
  })
  @Column({ type: 'simple-json', nullable: true })
  creditor_codes: string[] | null;

  @ApiPropertyOptional({ description: 'ลำดับการแสดงผล', example: 0 })
  @Column({ default: 0 })
  display_order: number;

  @ApiPropertyOptional({ description: 'สถานะเปิดใช้งาน', example: true })
  @Column({ default: true })
  is_active: boolean;

  @ApiProperty({ description: 'วันเวลาที่สร้าง' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'วันเวลาที่แก้ไขล่าสุด' })
  @UpdateDateColumn()
  updated_at: Date;
}
