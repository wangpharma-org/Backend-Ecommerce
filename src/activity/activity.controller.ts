import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ACTIVITY_MAX_BATCH } from './activity.constants';
import { ActivityService } from './activity.service';
import {
  ActivityEvent,
  channelFromRequest,
  normalizeClientEvent,
} from './activity.types';

interface JwtUser {
  mem_code: string;
}

@Controller()
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  /**
   * รับอีเวนต์ impression/open/click/checkout จากหน้าเว็บ/แอป เป็นชุด
   * mem_code มาจาก token เสมอ · add_cart/order ส่งจาก server เท่านั้น (รายการแบบนั้นถูกทิ้ง)
   * enabled=false บอกให้ client หยุดส่งไปจนจบ session
   */
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/activity')
  @HttpCode(200)
  async track(
    @Req() req: Request & { user: JwtUser },
    @Body() body: { events?: unknown },
  ) {
    const raw = body?.events;
    if (!Array.isArray(raw))
      throw new BadRequestException('events must be an array');
    if (raw.length > ACTIVITY_MAX_BATCH) {
      throw new BadRequestException(`at most ${ACTIVITY_MAX_BATCH} events`);
    }
    const enabled = await this.activity.isEnabled();
    const memCode = req.user?.mem_code?.trim();
    if (!enabled || !memCode) {
      return { enabled, accepted: 0, dropped: raw.length };
    }
    const ctx = {
      mem_code: memCode,
      channel: channelFromRequest(req),
      source: 'ecommerce-client',
    };
    const events = raw
      .map((r) => normalizeClientEvent(r, ctx))
      .filter((e): e is ActivityEvent => e !== null);
    const accepted = await this.activity.emit(
      await this.activity.resolvePromotionFeature(events),
    );
    return { enabled, accepted, dropped: raw.length - accepted };
  }
}
