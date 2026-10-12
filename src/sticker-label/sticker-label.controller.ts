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
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import {
  PrintRequestBody,
  StickerActor,
  StickerLabelService,
} from './sticker-label.service';

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
    body: PrintRequestBody,
  ) {
    return this.service.recordPrint(assertAdmin(req), body);
  }

  /** ECWC-704 PDF พร้อมบันทึก log — id ของ log อยู่ใน header X-Print-Log-Ids */
  @Post('admin/sticker-label/print/pdf')
  async printPdf(
    @Req() req: AuthedRequest,
    @Body() body: PrintRequestBody,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { pdf, logs, pages } = await this.service.printPdf(
      assertAdmin(req),
      body,
    );
    res.setHeader('X-Print-Log-Ids', logs.map((l) => l.id).join(','));
    res.setHeader('X-Print-Pages', String(pages));
    res.setHeader(
      'Access-Control-Expose-Headers',
      'X-Print-Log-Ids, X-Print-Pages',
    );
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="sticker-${logs[0]?.print_type ?? 'print'}-${Date.now()}.pdf"`,
    });
  }

  @Get('admin/sticker-label/lines/:spo_id/preview.pdf')
  async previewPdf(
    @Req() req: AuthedRequest,
    @Param('spo_id', ParseIntPipe) spo_id: number,
  ) {
    assertAdmin(req);
    const pdf = await this.service.previewPdf(spo_id);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `inline; filename="sticker-preview-${spo_id}.pdf"`,
    });
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
