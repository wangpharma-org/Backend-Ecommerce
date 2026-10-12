import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { StickerActor, StickerLabelService } from './sticker-label.service';

type AuthedRequest = Request & { user: JwtPayload };

function actorOf(req: AuthedRequest): StickerActor {
  return {
    mem_code: req.user.mem_code,
    username: req.user.username,
    price_option: req.user.price_option,
    mem_route: req.user.mem_route,
  };
}

/** สิทธิ์ admin ใช้ permission จาก JWT ตาม pattern เดิมใน app.controller */
function assertAdmin(req: AuthedRequest): StickerActor {
  if (req.user?.permission !== true) {
    throw new ForbiddenException('You not have Permission to Access');
  }
  return actorOf(req);
}

/** ECWC-697 สติ๊กเกอร์ฉลากยา แบบพิมพ์หัวร้าน */
@Controller('ecom')
@UseGuards(JwtAuthGuard)
export class StickerLabelController {
  constructor(private readonly service: StickerLabelService) {}

  // ---------- ลูกค้า ----------

  @Get('sticker-label/config')
  async getConfig(@Req() req: AuthedRequest) {
    await this.service.assertEnabled();
    return this.service.getConfig(actorOf(req));
  }

  @Get('sticker-label/last-options')
  async getLastOptions(@Req() req: AuthedRequest) {
    await this.service.assertEnabled();
    return {
      custom_options: await this.service.getLastOptions(req.user.mem_code),
    };
  }

  @Post('sticker-label/cart')
  async addToCart(
    @Req() req: AuthedRequest,
    @Body()
    body: { custom_options: unknown; packs: unknown; clientVersion?: string },
  ) {
    await this.service.assertEnabled();
    return this.service.addToCart(actorOf(req), body);
  }

  @Post('sticker-label/cart/update')
  async updateCartLine(
    @Req() req: AuthedRequest,
    @Body() body: { spc_id: unknown; packs: unknown; clientVersion?: string },
  ) {
    await this.service.assertEnabled();
    return this.service.updateCartLine(actorOf(req), body);
  }

  // ---------- admin คิวพิมพ์ ----------

  @Get('admin/sticker-label/printers')
  getPrinters(@Req() req: AuthedRequest) {
    assertAdmin(req);
    return this.service.getPrinters();
  }

  @Get('admin/sticker-label/queue')
  getQueue(
    @Req() req: AuthedRequest,
    @Query() query: { status?: string; page?: string; limit?: string },
  ) {
    assertAdmin(req);
    return this.service.getQueue(query);
  }

  @Post('admin/sticker-label/print')
  recordPrint(
    @Req() req: AuthedRequest,
    @Body()
    body: { order_line_ids: unknown; print_type: unknown; printer: unknown },
  ) {
    return this.service.recordPrint(assertAdmin(req), body);
  }

  @Get('admin/sticker-label/lines/:spo_id/logs')
  getLineLogs(
    @Req() req: AuthedRequest,
    @Param('spo_id', ParseIntPipe) spo_id: number,
  ) {
    assertAdmin(req);
    return this.service.getLineLogs(spo_id);
  }
}
