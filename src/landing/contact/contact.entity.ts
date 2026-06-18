import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ContactStatus {
  PENDING = 'pending',
  READ = 'read',
  REPLIED = 'replied',
  CLOSED = 'closed',
}

@Entity({ name: 'landing_contacts' })
export class ContactEntity {
  @ApiProperty({ description: 'รหัสของข้อความติดต่อ', example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ description: 'ชื่อผู้ติดต่อ', example: 'สมชาย ใจดี' })
  @Column({ length: 100 })
  name: string;

  @ApiProperty({ description: 'อีเมลผู้ติดต่อ', example: 'somchai@example.com' })
  @Column({ length: 100 })
  email: string;

  @ApiPropertyOptional({ description: 'เบอร์โทรศัพท์', example: '0812345678' })
  @Column({ length: 20, nullable: true })
  phone: string;

  @ApiPropertyOptional({ description: 'ชื่อบริษัท/ร้าน', example: 'ร้านยาสมชาย' })
  @Column({ length: 100, nullable: true })
  company: string;

  @ApiProperty({ description: 'หัวข้อเรื่องที่ติดต่อ', example: 'สอบถามเรื่องสินค้า' })
  @Column({ length: 200 })
  subject: string;

  @ApiProperty({ description: 'เนื้อหาข้อความ', example: 'อยากสอบถามเรื่องราคาสินค้า' })
  @Column({ type: 'text' })
  message: string;

  @ApiProperty({
    description: 'สถานะของข้อความติดต่อ',
    enum: ContactStatus,
    example: ContactStatus.PENDING,
  })
  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.PENDING,
  })
  status: ContactStatus;

  @ApiPropertyOptional({ description: 'บันทึกของแอดมิน', example: 'ติดต่อกลับแล้ว' })
  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @ApiPropertyOptional({ description: 'ชื่อแอดมินผู้ตอบกลับ', example: 'admin01' })
  @Column({ length: 100, nullable: true })
  replied_by: string;

  @ApiPropertyOptional({ description: 'วันเวลาที่ตอบกลับ' })
  @Column({ nullable: true })
  replied_at: Date;

  @ApiProperty({ description: 'วันเวลาที่สร้างข้อความ' })
  @CreateDateColumn()
  created_at: Date;

  @ApiProperty({ description: 'วันเวลาที่แก้ไขล่าสุด' })
  @UpdateDateColumn()
  updated_at: Date;
}
