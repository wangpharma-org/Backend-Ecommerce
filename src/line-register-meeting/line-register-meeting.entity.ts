import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Attendee } from './attendee.entity';

@Entity('line_register_meeting')
export class LineRegisterMeetingEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  mem_code!: string;

  @Column({ type: 'varchar' })
  store_name!: string;

  @OneToMany(() => Attendee, (attendee) => attendee.meeting, {
    cascade: true,
  })
  attendees!: Attendee[];
}
