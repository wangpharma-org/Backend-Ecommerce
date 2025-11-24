import {
  Column,
  Entity,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum AppOS {
  ANDROID = 'android',
  IOS = 'ios',
}

@Entity('app_version')
export class AppVersionEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  latestVersion: string;

  @Column({ default: false })
  forceUpdate: boolean;

  @Column({ type: 'varchar', nullable: true })
  androidStoreUrl: string;

  @Column({ type: 'varchar', nullable: true })
  iosStoreUrl: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
