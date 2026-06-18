import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LineOaMonitorService, LineOaMonitorResponse } from './line-oa-monitor.service';

@ApiTags('LINE OA Monitor')
@Controller('ecom')
export class LineOaMonitorController {
  constructor(private readonly lineOaMonitorService: LineOaMonitorService) {}

  @ApiOperation({
    summary:
      'ดึงข้อมูลสรุปสถานะการลงทะเบียน LINE OA ของสมาชิกทั้งหมด (admin)',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description:
      'สรุปจำนวนสมาชิกทั้งหมด/ลงทะเบียนแล้ว/ยังไม่ลงทะเบียน พร้อมรายชื่อสมาชิก',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/line-oa-monitor')
  async getMonitorData(): Promise<LineOaMonitorResponse> {
    return this.lineOaMonitorService.getMonitorData();
  }
}
