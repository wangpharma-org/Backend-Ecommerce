import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { JwtPayload } from '../app.controller';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PasswordResetService, StaffActor } from './password-reset.service';
import { PASSWORD_RESET_FEATURE_FLAG } from './password-reset.rules';

type AuthedRequest = Request & { user: JwtPayload & { scope?: string } };

function header(req: Request, name: string): string {
  const v = req.headers[name];
  return (Array.isArray(v) ? v[0] : (v ?? '')).trim();
}

/**
 * ผู้ทำรายการจาก sale service (ส่งมาพร้อม x-internal-token)
 * - x-actor-emp-code: รหัสพนักงาน (employee.emp_code) จาก JWT ของ Wang Auth
 * - x-actor-name: ชื่อพนักงาน (encodeURIComponent เพราะ header เป็น ASCII)
 * - x-actor-scope: all = เห็นทุกร้าน · อื่นๆ = เฉพาะร้านที่ users.emp_id_ref ตรงกับรหัสพนักงาน
 * - x-actor-supervisor: 1 = ปิด "บังคับตั้งรหัสใหม่" ได้
 */
function actorOf(req: Request): StaffActor {
  const empCode = header(req, 'x-actor-emp-code');
  if (!/^[A-Za-z0-9_-]{1,20}$/.test(empCode)) {
    throw new BadRequestException('x-actor-emp-code ไม่ถูกต้อง');
  }
  let name = '';
  try {
    name = decodeURIComponent(header(req, 'x-actor-name')).slice(0, 200);
  } catch {
    name = '';
  }
  return {
    emp_code: empCode,
    name,
    all_stores: header(req, 'x-actor-scope') === 'all',
    supervisor: header(req, 'x-actor-supervisor') === '1',
  };
}

function clientIp(req: Request): string | null {
  const xff = req.headers['x-forwarded-for'];
  const ip =
    (Array.isArray(xff) ? xff[0] : xff?.split(',')[0]?.trim()) ??
    req.ip ??
    null;
  return ip ? ip.slice(0, 45) : null;
}

@Controller('ecom')
export class PasswordResetController {
  constructor(
    private readonly service: PasswordResetService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async assertEnabled() {
    const enabled = await this.featureFlags.getFlag(
      PASSWORD_RESET_FEATURE_FLAG,
    );
    if (!enabled) {
      throw new ForbiddenException(
        'ฟีเจอร์รีเซ็ตรหัสผ่านผ่านพนักงานยังไม่เปิดใช้งาน',
      );
    }
  }

  // ==================== CUSTOMER (ไม่ต้อง login) ====================

  @Post('password-reset/requests')
  @HttpCode(HttpStatus.OK)
  async create(
    @Req() req: Request,
    @Body()
    body: {
      account?: unknown;
      phone_changed?: unknown;
      callback_phone?: unknown;
    },
  ) {
    await this.assertEnabled();
    const ua = req.headers['user-agent'];
    return this.service.createRequest(body, {
      ip: clientIp(req),
      userAgent: typeof ua === 'string' ? ua : null,
    });
  }

  @Get('password-reset/requests/:ref')
  async status(@Param('ref') ref: string) {
    return this.service.getStatus(ref);
  }

  // ============ CUSTOMER (token จากรหัสผ่านชั่วคราว) — ไม่ผูก flag ============

  @UseGuards(JwtAuthGuard)
  @Post('password-reset/set-password')
  @HttpCode(HttpStatus.OK)
  async setPassword(
    @Req() req: AuthedRequest,
    @Body()
    body: {
      new_password?: unknown;
      confirm_password?: unknown;
      logout_all_devices?: unknown;
    },
  ) {
    return this.service.setNewPassword(req.user.mem_code, body);
  }

  // ======== STAFF — เรียกจาก sale service เท่านั้น (wangpharma-sale-backend) ========

  @UseGuards(InternalTokenGuard)
  @Get('internal/password-reset/summary')
  async summary(@Req() req: Request) {
    const actor = actorOf(req);
    await this.assertEnabled();
    return this.service.pendingCount(actor);
  }

  @UseGuards(InternalTokenGuard)
  @Get('internal/password-reset/requests')
  async list(
    @Req() req: Request,
    @Query('tab') tab?: string,
    @Query('q') q?: string,
  ) {
    const actor = actorOf(req);
    await this.assertEnabled();
    return this.service.list(actor, tab, q);
  }

  @UseGuards(InternalTokenGuard)
  @Get('internal/password-reset/requests/:id')
  async detail(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
    const actor = actorOf(req);
    await this.assertEnabled();
    return this.service.detail(actor, id);
  }

  @UseGuards(InternalTokenGuard)
  @Post('internal/password-reset/requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      checklist?: unknown;
      mode?: unknown;
      password?: unknown;
      force_change?: unknown;
      note?: unknown;
    },
  ) {
    const actor = actorOf(req);
    await this.assertEnabled();
    return this.service.approve(actor, id, body);
  }

  @UseGuards(InternalTokenGuard)
  @Post('internal/password-reset/requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: unknown; note?: unknown },
  ) {
    const actor = actorOf(req);
    await this.assertEnabled();
    return this.service.reject(actor, id, body);
  }
}
