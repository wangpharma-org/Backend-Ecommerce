import { Controller, Res } from '@nestjs/common';
import { Get, Post, Body } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { LineRegisterMeetingService } from './line-register-meeting.service';
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
  @ApiBody({
    schema: {
      type: 'object',
      required: ['mem_code', 'store_name', 'attendees'],
      properties: {
        mem_code: { type: 'string', description: 'รหัสสมาชิก/ร้านค้า' },
        store_name: { type: 'string', description: 'ชื่อร้านค้า' },
        attendees: {
          type: 'array',
          description: 'รายชื่อผู้เข้าร่วมประชุม',
          items: {
            type: 'object',
            properties: {
              member_name: { type: 'string', description: 'ชื่อผู้เข้าร่วม' },
              phone: { type: 'string', description: 'เบอร์โทรศัพท์' },
              province: { type: 'string', description: 'จังหวัด' },
              line_id: { type: 'string', description: 'LINE ID' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'ลงทะเบียนเข้าร่วมประชุมสำเร็จ',
  })
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
