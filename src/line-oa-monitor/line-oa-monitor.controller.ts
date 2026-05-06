import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LineOaMonitorService, LineOaMonitorResponse } from './line-oa-monitor.service';

@Controller('ecom')
export class LineOaMonitorController {
  constructor(private readonly lineOaMonitorService: LineOaMonitorService) {}

  @UseGuards(JwtAuthGuard)
  @Get('admin/line-oa-monitor')
  async getMonitorData(): Promise<LineOaMonitorResponse> {
    return this.lineOaMonitorService.getMonitorData();
  }
}
