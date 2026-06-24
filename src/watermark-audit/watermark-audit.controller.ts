import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { WatermarkAuditService } from './watermark-audit.service';

@ApiTags('Watermark Audit')
@ApiBearerAuth()
@Controller('ecom')
export class WatermarkAuditController {
  constructor(private readonly service: WatermarkAuditService) {}

  @ApiOperation({
    summary: 'ออก watermark token สำหรับหน้าที่ระบุ เพื่อใช้ติดตามแหล่งที่มาของข้อมูลที่หลุดออกไป',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        page: {
          type: 'string',
          example: '/products/A001',
          description: 'Required; not empty; ชื่อ/path ของหน้าที่ขอ watermark token',
        },
      },
      required: ['page'],
    },
  })
  @ApiResponse({ status: 201, description: 'ออก watermark token สำเร็จ' })
  @ApiResponse({ status: 400, description: 'page จำเป็นต้องระบุ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

  // Admin: resolve a leaked watermark token -> who/when/which page.
  @ApiOperation({
    summary: 'ค้นหาข้อมูลที่มาของ watermark token ที่หลุดออกไป (ใคร/เมื่อไหร่/หน้าไหน) — เฉพาะ admin',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    example: 'wmk_3f9c1a2b4e5d6f7890abcdef12345678',
    description: 'Required; not empty; watermark token ที่ต้องการตรวจสอบ',
  })
  @ApiResponse({ status: 200, description: 'ข้อมูลผู้ออก token, เวลา, และหน้าที่เกี่ยวข้อง' })
  @ApiResponse({ status: 400, description: 'token จำเป็นต้องระบุ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @UseGuards(JwtAuthGuard)
  @Get('watermark/lookup')
  lookup(
    @Req() req: Request & { user: JwtPayload },
    @Query('token') token: string,
  ) {
    if (req.user.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }
    if (!token) {
      throw new BadRequestException('token จำเป็นต้องระบุ');
    }
    return this.service.lookup(token.trim());
  }
}
