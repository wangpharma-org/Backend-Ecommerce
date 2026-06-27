import { Controller, Res } from '@nestjs/common';
import { Get, Post, Body } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LineRegisterMeetingService } from './line-register-meeting.service';
import { RegisterMeetingDto } from 'src/common/dto-index';
import { Response } from 'express';

@ApiTags('LINE Register Meeting')
@Controller('ecom/line-register-meeting')
export class LineRegisterMeetingController {
  constructor(
    private readonly lineRegisterMeetingService: LineRegisterMeetingService,
  ) {}

  @ApiOperation({
    summary: 'ส่งออกรายชื่อสมาชิกที่ลงทะเบียนเข้าร่วมประชุมเป็นไฟล์ Excel',
  })
  @ApiResponse({
    status: 200,
    description: 'ไฟล์ Excel (.xlsx) รายชื่อสมาชิกที่ลงทะเบียนเข้าร่วมประชุม',
  })
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

  @ApiOperation({ summary: 'ลงทะเบียนร้านค้าและผู้เข้าร่วมประชุมผ่าน LINE' })
  @ApiBody({ type: RegisterMeetingDto })
  @ApiResponse({
    status: 201,
    description: 'ลงทะเบียนเข้าร่วมประชุมสำเร็จ',
    schema: {
      example: {
        id: 1,
        mem_code: 'M00001',
        store_name: 'ร้านยาสุขภาพดี',
        attendees: [
          {
            member_name: 'สมชาย ใจดี',
            phone: '0812345678',
            province: 'กรุงเทพมหานคร',
            line_id: 'U1234567890abcdef1234567890abcdef',
          },
        ],
      },
    },
  })
  @Post()
  registerMeeting(@Body() data: RegisterMeetingDto) {
    return this.lineRegisterMeetingService.registerMeeting(data);
  }
}
