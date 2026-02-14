import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConfigType {
  TEXT = 'text',
  HTML = 'html',
  JSON = 'json',
  IMAGE = 'image',
  URL = 'url',
}

@Entity({ name: 'landing_site_configs' })
export class SiteConfigEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100, unique: true })
  config_key: string;

  @Column({ type: 'text' })
  config_value: string;

  @Column({
    type: 'enum',
    enum: ConfigType,
    default: ConfigType.TEXT,
  })
  config_type: ConfigType;

  @Column({ length: 200, nullable: true })
  description: string;

  @Column({ length: 100, nullable: true })
  category: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
