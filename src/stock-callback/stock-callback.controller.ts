import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { channelFromRequest } from '../activity/activity.types';
import { ownCartMemCode } from '../shopping-cart/cart-owner';
import { StockCallbackService } from './stock-callback.service';
import {
  parseCustomerRequest,
  parseListQuery,
  parseStatusUpdate,
} from './stock-callback.validation';

/// ECWC-766: ลูกค้าสั่งเกินสต็อก → ขอให้ฝ่ายขายติดต่อกลับ · ระบบขายดึงรายการ/เปลี่ยนสถานะผ่าน internal API
@Controller()
export class StockCallbackController {
  constructor(private readonly service: StockCallbackService) {}

  /// ร้านมาจาก token เท่านั้น
  @UseGuards(JwtAuthGuard)
  @Post('/ecom/cart/stock-callback-request')
  @HttpCode(201)
  async request(
    @Req() req: { user: { mem_code?: unknown } },
    @Body() body: unknown,
  ) {
    const memCode = ownCartMemCode(req.user, undefined);
    return this.service.request(
      memCode,
      parseCustomerRequest(body),
      channelFromRequest(req),
    );
  }

  /// ระบบขาย (sale-backend) — x-internal-token เท่านั้น
  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/stock-callback-requests')
  async list(@Query() query: Record<string, unknown>) {
    return this.service.list(parseListQuery(query));
  }

  @UseGuards(InternalTokenGuard)
  @Patch('/ecom/internal/stock-callback-requests/:id')
  async update(@Param('id') id: string, @Body() body: unknown) {
    if (!/^\d{1,10}$/.test(id ?? '')) {
      throw new BadRequestException('id ไม่ถูกต้อง');
    }
    return this.service.updateStatus(Number(id), parseStatusUpdate(body));
  }
}
