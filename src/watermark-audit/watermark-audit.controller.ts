import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { WatermarkAuditService } from './watermark-audit.service';

@Controller('ecom')
export class WatermarkAuditController {
  constructor(private readonly service: WatermarkAuditService) {}

  @UseGuards(JwtAuthGuard)
  @Post('watermark/token')
  issueToken(
    @Req() req: Request & { user: JwtPayload },
    @Body('page') page: string,
  ) {
    if (!page) {
      throw new BadRequestException('page จำเป็นต้องระบุ');
    }
    const xff = req.headers['x-forwarded-for'];
    const ip =
      (Array.isArray(xff) ? xff[0] : xff?.split(',')[0]?.trim()) ??
      req.ip ??
      null;
    const userAgent = req.headers['user-agent'] ?? null;

    return this.service.issueToken({
      mem_code: req.user.mem_code,
      page,
      ip,
      user_agent: userAgent,
    });
  }
}
