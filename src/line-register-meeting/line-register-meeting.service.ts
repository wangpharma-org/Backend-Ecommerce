import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LineRegisterMeetingEntity } from './line-register-meeting.entity';
import * as ExcelJS from 'exceljs';

@Injectable()
export class LineRegisterMeetingService {
  constructor(
    @InjectRepository(LineRegisterMeetingEntity)
    private readonly lineRegisterMeetingRepo: Repository<LineRegisterMeetingEntity>,
  ) {}

  async registerMeeting(data: {
    mem_code: string;
    store_name: string;
    attendees: {
      member_name: string;
      phone: string;
      province: string;
      line_id: string;
    }[];
  }) {
    try {
      const meeting = this.lineRegisterMeetingRepo.create(data);
      return await this.lineRegisterMeetingRepo.save(meeting);
    } catch {
      throw new Error('Failed to register meeting');
    }
  }

  async getAllMember(): Promise<Buffer> {
    try {
      const data = await this.lineRegisterMeetingRepo.find({
        relations: {
          attendees: true,
        },
      });

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Members');

      worksheet.columns = [
        { header: 'รหัสลูกค้า', key: 'mem_code', width: 20 },
        { header: 'ชื่อร้าน', key: 'store_name', width: 30 },
        { header: 'ชื่อสมาชิก', key: 'member_name', width: 25 },
        { header: 'เบอร์โทรศัพท์', key: 'phone', width: 20 },
        { header: 'จังหวัด', key: 'province', width: 20 },
        { header: 'Line ID', key: 'line_id', width: 30 },
      ];

      data.forEach((meeting) => {
        meeting.attendees?.forEach((att) => {
          worksheet.addRow({
            mem_code: meeting.mem_code,
            store_name: meeting.store_name,
            member_name: att.member_name,
            phone: att.phone,
            province: att.province,
            line_id: att.line_id,
          });
        });
      });

      worksheet.getRow(1).font = { bold: true };

      const arrayBuffer = await workbook.xlsx.writeBuffer();

      return Buffer.from(arrayBuffer);
    } catch {
      throw new Error('Failed to export members');
    }
  }
}
