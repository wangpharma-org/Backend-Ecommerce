import { Module } from '@nestjs/common';
import { LineRegisterMeetingService } from './line-register-meeting.service';
import { LineRegisterMeetingController } from './line-register-meeting.controller';
import { LineRegisterMeetingEntity } from './line-register-meeting.entity';
import { Attendee } from './attendee.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([LineRegisterMeetingEntity, Attendee])],
  providers: [LineRegisterMeetingService],
  controllers: [LineRegisterMeetingController],
})
export class LineRegisterMeetingModule {}
