import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  SalesCartSessionService,
  SalesPerson,
} from './sales-cart-session.service';

const UUID = /^[0-9a-f-]{36}$/i;
const str = (v: unknown, max: number) =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;

/// รอบที่พนักงานขายเข้าดูแลตะกร้าลูกค้า + ความยินยอมของลูกค้า
/// /ecom/internal/* = ระบบขายเรียก (x-internal-token) · /ecom/sales-cart-* = ลูกค้าที่ login (เว็บ/แอป)
@Controller()
export class SalesCartSessionController {
  constructor(private readonly service: SalesCartSessionService) {}

  private memCode(v: unknown) {
    const code = typeof v === 'string' ? v.trim() : '';
    if (!code || code.length > 50)
      throw new BadRequestException('mem_code ไม่ถูกต้อง');
    return code;
  }

  private id(v: string) {
    if (!UUID.test(v ?? '')) throw new BadRequestException('id ไม่ถูกต้อง');
    return v;
  }

  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/sales-cart-session')
  @HttpCode(200)
  start(@Body() body: Record<string, unknown>) {
    const who: SalesPerson = {
      emp_code: str(body?.emp_code, 30),
      sales_name: str(body?.sales_name, 120),
      sales_nick: str(body?.sales_nick, 60),
    };
    return this.service.start(
      this.memCode(body?.mem_code),
      who,
      str(body?.draft_ref, 64),
      SalesCartSessionService.lines(body?.lines),
    );
  }

  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/sales-cart-session/:id')
  get(@Param('id') id: string) {
    return this.service.get(this.id(id));
  }

  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/sales-cart-session/:id/touch')
  @HttpCode(200)
  touch(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.touch(
      this.id(id),
      body?.lines === undefined
        ? null
        : SalesCartSessionService.lines(body.lines),
    );
  }

  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/sales-cart-session/:id/phone-consent')
  @HttpCode(200)
  phone(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.phoneConsent(this.id(id), str(body?.emp_code, 30));
  }

  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/sales-cart-session/:id/end')
  @HttpCode(200)
  end(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    const reason = body?.reason;
    if (reason !== 'saved' && reason !== 'discarded')
      throw new BadRequestException('reason ต้องเป็น saved หรือ discarded');
    return this.service.end(this.id(id), reason);
  }

  // ---------- ลูกค้า ----------

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/sales-cart-session/current')
  current(@Req() req: Request & { user: { mem_code: string } }) {
    return this.service.current(this.memCode(req.user?.mem_code));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/sales-cart-session/consent/:id')
  @HttpCode(200)
  decide(
    @Req() req: Request & { user: { mem_code: string } },
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    const consentId = Number(id);
    if (!Number.isInteger(consentId) || consentId < 1)
      throw new BadRequestException('id ไม่ถูกต้อง');
    const decision = body?.decision;
    if (decision !== 'allow' && decision !== 'deny')
      throw new BadRequestException('decision ต้องเป็น allow หรือ deny');
    const channel = body?.channel === 'app' ? 'app' : 'web';
    return this.service.decide(
      this.memCode(req.user?.mem_code),
      consentId,
      decision,
      channel,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('/ecom/sales-cart-consent')
  consent(@Req() req: Request & { user: { mem_code: string } }) {
    return this.service.current(this.memCode(req.user?.mem_code));
  }

  @UseGuards(JwtAuthGuard)
  @Post('/ecom/sales-cart-consent/withdraw')
  @HttpCode(200)
  withdraw(@Req() req: Request & { user: { mem_code: string } }) {
    return this.service.withdraw(this.memCode(req.user?.mem_code));
  }
}
