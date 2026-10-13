import {
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
import { JwtPayload } from '../app.controller';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PasswordResetService, StaffActor } from './password-reset.service';
import { PASSWORD_RESET_FEATURE_FLAG } from './password-reset.rules';

type AuthedRequest = Request & { user: JwtPayload & { scope?: string } };

/** admin หรือเซลล์ (role Sales) เท่านั้น — token ขอบเขตพิเศษใช้ไม่ได้ */
function staffOf(req: AuthedRequest): StaffActor {
  const u = req.user;
  if (u?.scope || (u?.permission !== true && u?.role !== 'Sales')) {
    throw new ForbiddenException('You not have Permission to Access');
  }
  return {
    mem_code: u.mem_code,
    name: u.name,
    permission: u.permission,
    role: u.role,
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

  // ==================== STAFF ====================

  @UseGuards(JwtAuthGuard)
  @Get('staff/password-reset/summary')
  async summary(@Req() req: AuthedRequest) {
    const actor = staffOf(req);
    await this.assertEnabled();
    return this.service.pendingCount(actor);
  }

  @UseGuards(JwtAuthGuard)
  @Get('staff/password-reset/requests')
  async list(
    @Req() req: AuthedRequest,
    @Query('tab') tab?: string,
    @Query('q') q?: string,
  ) {
    const actor = staffOf(req);
    await this.assertEnabled();
    return this.service.list(actor, tab, q);
  }

  @UseGuards(JwtAuthGuard)
  @Get('staff/password-reset/requests/:id')
  async detail(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const actor = staffOf(req);
    await this.assertEnabled();
    return this.service.detail(actor, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('staff/password-reset/requests/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Req() req: AuthedRequest,
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
    const actor = staffOf(req);
    await this.assertEnabled();
    return this.service.approve(actor, id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('staff/password-reset/requests/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { reason?: unknown; note?: unknown },
  ) {
    const actor = staffOf(req);
    await this.assertEnabled();
    return this.service.reject(actor, id, body);
  }
}
