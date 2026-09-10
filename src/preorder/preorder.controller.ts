import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PreorderService } from './preorder.service';
import { PreorderCampaignStatus } from './preorder-campaign.entity';
import {
  AddProductDto,
  AdminUpdateItemDto,
  AllocateDto,
  CreateCampaignDto,
  PreorderActor,
  StaffBookDto,
  UpdateCampaignDto,
  UpdateProductDto,
  UpsertItemDto,
} from './preorder.types';

type AuthedRequest = Request & { user: JwtPayload };

export const PREORDER_FEATURE_FLAG = 'preorder';

function actorOf(req: AuthedRequest): PreorderActor {
  return {
    mem_code: req.user.mem_code,
    username: req.user.username,
    price_option: req.user.price_option,
    permission: req.user.permission,
  };
}

/** สิทธิ์ admin ใช้ permission จาก JWT ตาม pattern เดิมใน app.controller */
function assertAdmin(req: AuthedRequest): PreorderActor {
  if (req.user?.permission !== true) {
    throw new ForbiddenException('You not have Permission to Access');
  }
  return actorOf(req);
}

/** admin หรือเซลล์ (role Sales) ทำแทนร้านได้ */
function assertStaff(req: AuthedRequest): PreorderActor {
  if (req.user?.permission !== true && req.user?.role !== 'Sales') {
    throw new ForbiddenException('You not have Permission to Access');
  }
  return actorOf(req);
}

@Controller('ecom')
@UseGuards(JwtAuthGuard)
export class PreorderController {
  constructor(
    private readonly service: PreorderService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  private async assertEnabled() {
    const enabled = await this.featureFlags.getFlag(PREORDER_FEATURE_FLAG);
    if (!enabled)
      throw new ForbiddenException('ฟีเจอร์สั่งจองสินค้ายังไม่เปิดใช้งาน');
  }

  // ==================== CUSTOMER ====================

  @Get('preorder/campaigns')
  async listOpen(@Req() req: AuthedRequest) {
    await this.assertEnabled();
    return this.service.listOpenCampaigns(actorOf(req));
  }

  @Get('preorder/my')
  async my(@Req() req: AuthedRequest) {
    await this.assertEnabled();
    return this.service.getMyItems(actorOf(req));
  }

  @Put('preorder/campaigns/:campaignId/products/:proCode')
  async upsert(
    @Req() req: AuthedRequest,
    @Param('campaignId', ParseIntPipe) campaignId: number,
    @Param('proCode') proCode: string,
    @Body() dto: UpsertItemDto,
  ) {
    await this.assertEnabled();
    return this.service.upsertItem(actorOf(req), campaignId, proCode, dto);
  }

  /** ลูกค้าส่งจำนวนที่ได้รับจัดสรรเข้าตะกร้าตัวเอง */
  @Post('preorder/items/:id/to-cart')
  @HttpCode(HttpStatus.OK)
  async myItemToCart(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertEnabled();
    return this.service.pushAllocatedToCart(
      actorOf(req),
      { itemId: id },
      { customer: true },
    );
  }

  @Delete('preorder/items/:id')
  async cancel(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.assertEnabled();
    return this.service.cancelItem(actorOf(req), id);
  }

  // ==================== ADMIN: campaigns ====================

  @Get('admin/preorder/campaigns')
  listCampaigns(
    @Req() req: AuthedRequest,
    @Query('status') status?: PreorderCampaignStatus,
  ) {
    assertAdmin(req);
    return this.service.listCampaigns(status);
  }

  @Post('admin/preorder/campaigns')
  createCampaign(@Req() req: AuthedRequest, @Body() dto: CreateCampaignDto) {
    return this.service.createCampaign(assertAdmin(req), dto);
  }

  @Get('admin/preorder/campaigns/:id')
  getCampaign(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertAdmin(req);
    return this.service.getCampaign(id);
  }

  @Patch('admin/preorder/campaigns/:id')
  updateCampaign(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCampaignDto,
  ) {
    assertAdmin(req);
    return this.service.updateCampaign(id, dto);
  }

  @Patch('admin/preorder/campaigns/:id/status')
  setStatus(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: PreorderCampaignStatus,
  ) {
    assertAdmin(req);
    return this.service.setCampaignStatus(id, status);
  }

  /** ใบสรุปยอดสั่งซื้อของรอบ (จัดกลุ่มตาม supplier) สำหรับส่งจัดซื้อ */
  @Get('admin/preorder/campaigns/:id/purchase-summary')
  purchaseSummary(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertAdmin(req);
    return this.service.purchaseSummary(id);
  }

  @Get('admin/preorder/campaigns/:id/purchase-summary.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header(
    'Content-Disposition',
    'attachment; filename="preorder-purchase-summary.csv"',
  )
  purchaseSummaryCsv(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertAdmin(req);
    return this.service.purchaseSummaryCsv(id);
  }

  /** เจ้าหน้าที่/เซลล์จองแทนร้าน */
  @Put('admin/preorder/campaigns/:id/products/:proCode/members/:memCode')
  staffBook(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Param('proCode') proCode: string,
    @Param('memCode') memCode: string,
    @Body() dto: StaffBookDto,
  ) {
    return this.service.staffBook(assertStaff(req), id, proCode, memCode, dto);
  }

  /** ค้นสินค้าด้วยรหัสหรือบาร์โค้ด (สแกนได้) สำหรับฟอร์มเพิ่มสินค้า */
  @Get('admin/preorder/product-lookup')
  lookupProduct(@Req() req: AuthedRequest, @Query('q') q: string) {
    assertAdmin(req);
    return this.service.lookupProduct(q);
  }

  @Post('admin/preorder/campaigns/:id/products')
  addProduct(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddProductDto,
  ) {
    assertAdmin(req);
    return this.service.addProduct(id, dto);
  }

  // ==================== ADMIN: products / queue ====================

  @Patch('admin/preorder/products/:id')
  updateProduct(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ) {
    assertAdmin(req);
    return this.service.updateProduct(id, dto);
  }

  @Delete('admin/preorder/products/:id')
  removeProduct(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    assertAdmin(req);
    return this.service.removeProduct(id);
  }

  @Get('admin/preorder/products/:id/queue')
  queue(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    assertAdmin(req);
    return this.service.getQueue(id);
  }

  @Get('admin/preorder/products/:id/queue.csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="preorder-queue.csv"')
  queueCsv(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    assertAdmin(req);
    return this.service.getQueueCsv(id);
  }

  @Post('admin/preorder/products/:id/allocate')
  @HttpCode(HttpStatus.OK)
  allocate(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AllocateDto,
  ) {
    return this.service.allocate(assertAdmin(req), id, dto ?? {});
  }

  // ==================== ADMIN: items ====================

  @Patch('admin/preorder/items/:id')
  updateItem(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AdminUpdateItemDto,
  ) {
    return this.service.adminUpdateItem(assertAdmin(req), id, dto);
  }

  @Delete('admin/preorder/items/:id')
  cancelItemByAdmin(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
    @Body('note') note?: string,
  ) {
    return this.service.adminCancelItem(assertAdmin(req), id, note);
  }

  /** ส่งจำนวนที่จัดสรรของทุกร้านในสินค้านี้เข้าตะกร้า */
  @Post('admin/preorder/products/:id/to-cart')
  @HttpCode(HttpStatus.OK)
  productToCart(
    @Req() req: AuthedRequest,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.pushAllocatedToCart(assertStaff(req), {
      preorderProductId: id,
    });
  }

  @Post('admin/preorder/items/:id/to-cart')
  @HttpCode(HttpStatus.OK)
  itemToCart(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    return this.service.pushAllocatedToCart(assertStaff(req), { itemId: id });
  }

  /** รัน cron เตือนก่อนปิดรอบทันที (ใช้ทดสอบ/กรณีต้องการเตือนซ้ำ) */
  @Post('admin/preorder/reminders/run')
  @HttpCode(HttpStatus.OK)
  runReminders(@Req() req: AuthedRequest) {
    assertAdmin(req);
    return this.service.remindClosingCampaigns();
  }

  @Get('admin/preorder/items/:id/logs')
  itemLogs(@Req() req: AuthedRequest, @Param('id', ParseIntPipe) id: number) {
    assertAdmin(req);
    return this.service.getItemLogs(id);
  }

  /** ยิงมือเมื่อระบบรับของไม่ได้ส่ง new-arrivals มา หรือใช้ทดสอบ e2e */
  @Post('admin/preorder/arrivals')
  arrivals(@Req() req: AuthedRequest, @Body('pro_codes') proCodes: string[]) {
    assertAdmin(req);
    return this.service.handleArrivals(Array.isArray(proCodes) ? proCodes : []);
  }
}
