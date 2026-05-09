import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { LineRegisterMeetingEntity } from './line-register-meeting.entity';

@Entity('attendee')
export class Attendee {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  member_name!: string;

  @Column({ type: 'varchar' })
  phone!: string;

  @Column({ type: 'varchar' })
  province!: string;

  @Column({ type: 'varchar' })
  line_id!: string;

  @ManyToOne(() => LineRegisterMeetingEntity, (meeting) => meeting.attendees, {
    onDelete: 'CASCADE',
  })
  meeting!: LineRegisterMeetingEntity;
}
