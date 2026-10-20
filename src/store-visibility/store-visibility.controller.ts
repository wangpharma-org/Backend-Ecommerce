import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import {
  StoreVisibilityLogContext,
  StoreVisibilityService,
} from './store-visibility.service';
import {
  MarkAskedStoreVisibilityDto,
  SetStoreVisibilityDto,
} from './dto/set-store-visibility.dto';
import { StoreVisibilityChannel } from './customer-store-visibility-log.entity';

// คอลัมน์ user_agent ยาว 255 — UA ของบางแอปยาวกว่านั้น ตัดทิ้งดีกว่า insert พัง
const USER_AGENT_MAX_LENGTH = 255;

// ECWC-600/601: ลูกค้าตั้งค่าของร้านตัวเอง (mem_code จาก token เท่านั้น)
@UseGuards(JwtAuthGuard)
@Controller('ecom/store-visibility')
export class StoreVisibilityController {
  constructor(
    private readonly storeVisibilityService: StoreVisibilityService,
  ) {}

  @Get()
  async getSetting(@Req() req: Request & { user: JwtPayload }) {
    return this.storeVisibilityService.getSetting(req.user.mem_code);
  }

  @Put()
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async setSetting(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: SetStoreVisibilityDto,
  ) {
    return this.storeVisibilityService.setSetting(
      req.user.mem_code,
      dto.show_store_name,
      this.logContext(req, dto.channel),
    );
  }

  // ECWC-600: การ์ดขอความยินยอมถูกแสดงแล้วลูกค้าปัดทิ้ง — นับไว้เพื่อหยุดถามเมื่อครบเพดาน
  @Post('asked')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async markAsked(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: MarkAskedStoreVisibilityDto,
  ) {
    return this.storeVisibilityService.markAsked(
      req.user.mem_code,
      this.logContext(req, dto.channel),
    );
  }

  private logContext(
    req: Request,
    channel: StoreVisibilityChannel | undefined,
  ): StoreVisibilityLogContext {
    return {
      channel: channel ?? 'WEB',
      ip: req.ip ?? null,
      user_agent:
        req.headers['user-agent']?.slice(0, USER_AGENT_MAX_LENGTH) ?? null,
    };
  }
}
