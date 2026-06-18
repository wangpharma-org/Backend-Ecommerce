import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

@Entity({ name: 'landing_testimonials' })
export class TestimonialEntity {
  @ApiProperty({ description: 'รหัสของคำรับรอง', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ชื่อผู้ให้คำรับรอง', example: 'สมหญิง รักดี' })
  @Column({ length: 100 })
  name: string;

  @ApiPropertyOptional({ description: 'ชื่อบริษัท/ร้าน', example: 'ร้านยาสมหญิง' })
  @Column({ length: 100, nullable: true })
  company: string;

  @ApiPropertyOptional({ description: 'ตำแหน่งของผู้ให้คำรับรอง', example: 'เภสัชกร' })
  @Column({ length: 100, nullable: true })
  position: string;

  @ApiProperty({ description: 'เนื้อหาคำรับรอง', example: 'ใช้งานง่ายและสะดวกมาก' })
  @Column({ type: 'text' })
  content: string;

  @ApiPropertyOptional({ description: 'คะแนนรีวิว (1-5)', example: 5 })
  @Column({ type: 'int', default: 5 })
  rating: number;

  @ApiPropertyOptional({ description: 'URL รูปประจำตัว', example: 'https://example.com/avatar.png' })
  @Column({ length: 500, nullable: true })
  avatar_url: string;

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
