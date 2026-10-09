import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { CustomerReturnService } from './customer-return.service';
import { InternalKeyGuard } from './internal-key.guard';
import { CreateReturnDto, ReturnCompletedDto } from './customer-return.dto';

type AuthedRequest = Request & { user: JwtPayload };

export const CUSTOMER_RETURN_FEATURE_FLAG = 'customer_return';

// ECWC-691: เมนู "ขอคืนสินค้า" ฝั่งลูกค้า — mem_code มาจาก JWT เสมอ
@Controller('ecom/customer-return')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class CustomerReturnController {
  constructor(
    private readonly service: CustomerReturnService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async assertEnabled() {
    const enabled = await this.featureFlags.getFlag(
      CUSTOMER_RETURN_FEATURE_FLAG,
    );
    if (!enabled) {
      throw new ForbiddenException('ฟีเจอร์ขอคืนสินค้ายังไม่เปิดใช้งาน');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('bills')
  async listBills(@Req() req: AuthedRequest) {
    await this.assertEnabled();
    return this.service.listBills(req.user.mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('bills/:sh_running')
  async getBill(
    @Req() req: AuthedRequest,
    @Param('sh_running') sh_running: string,
  ) {
    await this.assertEnabled();
    return this.service.getBill(req.user.mem_code, sh_running);
  }

  @UseGuards(JwtAuthGuard)
  @Get('pickup-options')
  async pickupOptions() {
    await this.assertEnabled();
    return this.service.getPickupOptions();
  }

  @UseGuards(JwtAuthGuard)
  @Get('lot-check')
  async lotCheck(
    @Query('pro_code') pro_code: string,
    @Query('lot') lot: string,
  ) {
    await this.assertEnabled();
    if (!pro_code || !lot) throw new BadRequestException('pro_code, lot');
    return this.service.lotCheck(pro_code, lot);
  }

  @UseGuards(JwtAuthGuard)
  @Post('photos')
  @UseInterceptors(
    FilesInterceptor('files', 4, { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  async uploadPhotos(
    @Req() req: AuthedRequest,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    await this.assertEnabled();
    return this.service.uploadPhotos(req.user.mem_code, files);
  }

  @UseGuards(JwtAuthGuard)
  @Post('requests')
  async create(@Req() req: AuthedRequest, @Body() dto: CreateReturnDto) {
    await this.assertEnabled();
    return this.service.create(req.user.mem_code, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests')
  async listRequests(@Req() req: AuthedRequest) {
    await this.assertEnabled();
    return this.service.listRequests(req.user.mem_code);
  }

  // กระดิ่ง: ไม่โยน 403 ตอนปิดฟีเจอร์ — คืนรายการว่าง เพราะ navbar เรียกทุกหน้า
  @UseGuards(JwtAuthGuard)
  @Get('notifications')
  async notifications(@Req() req: AuthedRequest) {
    const enabled = await this.featureFlags.getFlag(
      CUSTOMER_RETURN_FEATURE_FLAG,
    );
    if (!enabled) return [];
    return this.service.recentCompleted(req.user.mem_code);
  }

  @UseGuards(JwtAuthGuard)
  @Get('requests/:return_no')
  async getRequest(
    @Req() req: AuthedRequest,
    @Param('return_no') return_no: string,
  ) {
    await this.assertEnabled();
    return this.service.getRequest(req.user.mem_code, return_no);
  }

  // ---------- internal: เรียกจาก Order Picking ----------

  @UseGuards(InternalKeyGuard)
  @Post('internal/completed')
  @HttpCode(HttpStatus.OK)
  completed(@Body() dto: ReturnCompletedDto) {
    return this.service.handleCompleted(dto);
  }
}
