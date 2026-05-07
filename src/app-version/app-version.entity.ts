import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

export enum AppPlatform {
  ANDROID = 'android',
  IOS = 'ios',
}

@Entity('app_version_blacklist')
@Unique('UQ_app_version_blacklist_platform_version', ['platform', 'version'])
export class AppVersionEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({
    type: 'enum',
    enum: AppPlatform,
  })
  platform!: AppPlatform;

  @Column({ type: 'varchar', length: 50 })
  version!: string;

  @Column({
    type: 'varchar',
    length: 255,
    default: 'เวอร์ชันนี้ไม่รองรับ กรุณาอัปเดตแอป',
  })
  message!: string;

  @Column({ type: 'varchar', length: 500 })
  storeUrl!: string;

  @Column({ default: true })
  isActive!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
