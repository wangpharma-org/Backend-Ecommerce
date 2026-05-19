import { Controller, Res } from '@nestjs/common';
import { Get, Post, Body } from '@nestjs/common';
import { LineRegisterMeetingService } from './line-register-meeting.service';
import { Response } from 'express';

@Controller('ecom/line-register-meeting')
export class LineRegisterMeetingController {
  constructor(
    private readonly lineRegisterMeetingService: LineRegisterMeetingService,
  ) {}

  @Get('export')
  async exportExcel(@Res() res: Response) {
    const buffer = await this.lineRegisterMeetingService.getAllMember();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename=members.xlsx');

    res.end(buffer);
  }

  @Post()
  registerMeeting(
    @Body()
    data: {
      mem_code: string;
      store_name: string;
      attendees: {
        member_name: string;
        phone: string;
        province: string;
        line_id: string;
      }[];
    },
  ) {
    return this.lineRegisterMeetingService.registerMeeting(data);
  }
}
