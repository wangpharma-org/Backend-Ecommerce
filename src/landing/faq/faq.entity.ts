import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'landing_faqs' })
export class FaqEntity {
  @ApiProperty({ description: 'รหัสของคำถาม', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'คำถาม', example: 'สมัครสมาชิกอย่างไร' })
  @Column({ length: 500 })
  question: string;

  @ApiProperty({ description: 'คำตอบ', example: 'กรอกแบบฟอร์มลงทะเบียนและอัปโหลดเอกสาร' })
  @Column({ type: 'text' })
  answer: string;

  @ApiPropertyOptional({ description: 'หมวดหมู่ของคำถาม', example: 'การสมัครสมาชิก' })
  @Column({ length: 100, nullable: true })
  category: string;

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
