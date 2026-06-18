import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ConfigType {
  TEXT = 'text',
  HTML = 'html',
  JSON = 'json',
  IMAGE = 'image',
  URL = 'url',
}

@Entity({ name: 'landing_site_configs' })
export class SiteConfigEntity {
  @ApiProperty({ description: 'รหัสของ config', example: 1 })
  @PrimaryGeneratedColumn()
  id!: number;

  @ApiProperty({ description: 'คีย์ของ config (unique)', example: 'site_title' })
  @Column({ length: 100, unique: true })
  config_key!: string;

  @ApiProperty({ description: 'ค่าของ config', example: 'WangPharma E-commerce' })
  @Column({ type: 'text' })
  config_value!: string;

  @ApiProperty({
    description: 'ประเภทของค่า config',
    enum: ConfigType,
    example: ConfigType.TEXT,
  })
  @Column({
    type: 'enum',
    enum: ConfigType,
    default: ConfigType.TEXT,
  })
  config_type!: ConfigType;

  @ApiPropertyOptional({ description: 'คำอธิบาย config', example: 'ชื่อเว็บไซต์ที่แสดงบนหน้า Landing' })
  @Column({ length: 200, nullable: true })
  description!: string;

  @ApiPropertyOptional({ description: 'หมวดหมู่ของ config', example: 'general' })
  @Column({ length: 100, nullable: true })
  category!: string;

  @ApiPropertyOptional({ description: 'ซ่อนจาก public หรือไม่', example: false })
  @Column({ type: 'boolean', default: false })
  hidden!: boolean;

  @ApiProperty({ description: 'วันเวลาที่สร้าง' })
  @CreateDateColumn()
  created_at!: Date;

  @ApiProperty({ description: 'วันเวลาที่แก้ไขล่าสุด' })
  @UpdateDateColumn()
  updated_at!: Date;
}
