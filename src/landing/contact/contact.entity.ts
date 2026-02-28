import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ContactStatus {
  PENDING = 'pending',
  READ = 'read',
  REPLIED = 'replied',
  CLOSED = 'closed',
}

@Entity({ name: 'landing_contacts' })
export class ContactEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 100 })
  email: string;

  @Column({ length: 20, nullable: true })
  phone: string;

  @Column({ length: 100, nullable: true })
  company: string;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  @Column({
    type: 'enum',
    enum: ContactStatus,
    default: ContactStatus.PENDING,
  })
  status: ContactStatus;

  @Column({ type: 'text', nullable: true })
  admin_notes: string;

  @Column({ length: 100, nullable: true })
  replied_by: string;

  @Column({ nullable: true })
  replied_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
