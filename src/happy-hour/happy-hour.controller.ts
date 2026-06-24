import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Logger } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { HappyHourService } from './happy-hour.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SimulateDto } from './dto/simulate.dto';
import { CartPreviewDto } from './dto/cart-preview.dto';
import { SlotLogQueryDto } from './dto/slot-log-query.dto';
import { ConfigLogQueryDto } from './dto/config-log-query.dto';
interface JwtUser {
  username: string;
  name: string;
  email: string;
  mem_code: string;
  permission?: boolean;
  role?: string;
}

@ApiTags('Happy Hour')
@ApiBearerAuth()
@Controller('admin/happy-hour')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class HappyHourController {
  private readonly logger = new Logger(HappyHourController.name);

  constructor(private readonly happyHourService: HappyHourService) {}

  /** ดึงทุกอย่างใน 1 เส้น: config (พร้อม is_enabled computed) + slots ทั้งหมด */
  @ApiOperation({
    summary: 'ดึงข้อมูลภาพรวม Happy Hour ใน 1 เส้น (config พร้อม is_enabled computed + slots ทั้งหมด)',
  })
  @ApiResponse({ status: 200, description: 'ข้อมูล config และ slots ของ Happy Hour' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('overview')
  async getOverview() {
    const [config, slots] = await Promise.all([
      this.happyHourService.getConfigResponse(),
      this.happyHourService.getSlots(),
    ]);
    return { config, slots };
  }

  @ApiOperation({ summary: 'ดึงค่า config ปัจจุบันของ Happy Hour (พร้อม is_enabled computed)' })
  @ApiResponse({ status: 200, description: 'ค่า config ปัจจุบันของ Happy Hour' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('config')
  getConfig() {
    return this.happyHourService.getConfigResponse();
  }

  @ApiOperation({ summary: 'แก้ไขค่า config ของ Happy Hour (เปิด/ปิด, ช่วงวันที่)' })
  @ApiBody({ type: UpdateConfigDto })
  @ApiResponse({ status: 200, description: 'แก้ไข config สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch('config')
  updateConfig(@Body() dto: UpdateConfigDto, @Req() req: { user: JwtUser }) {
    this.logger.log(`User ${req.user.username} is updating happy hour config`, {
      is_enabled: dto.is_enabled,
    });
    return this.happyHourService.updateConfig(dto, req.user.username);
  }

  @ApiOperation({ summary: 'สลับสถานะเปิด/ปิดการใช้งาน Happy Hour' })
  @ApiResponse({ status: 200, description: 'สลับสถานะสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Patch('toggle')
  toggle(@Req() req: { user: JwtUser }) {
    this.logger.log(`User ${req.user.username} is toggling happy hour`, {
      mem_code: req.user.mem_code,
      role: req.user.role,
      permission: req.user.permission,
    });
    return this.happyHourService.toggle(req.user.username);
  }

  @ApiOperation({ summary: 'ดึงรายการ slots ของ Happy Hour ทั้งหมด' })
  @ApiResponse({ status: 200, description: 'รายการ slots ทั้งหมด' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('slots')
  getSlots() {
    return this.happyHourService.getSlots();
  }

  @ApiOperation({ summary: 'สร้าง slot ใหม่สำหรับ Happy Hour' })
  @ApiBody({ type: CreateSlotDto })
  @ApiResponse({ status: 201, description: 'สร้าง slot สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('slots')
  createSlot(@Body() dto: CreateSlotDto, @Req() req: { user: JwtUser }) {
    return this.happyHourService.createSlot(dto, req.user.username);
  }

  @ApiOperation({ summary: 'แก้ไข slot ของ Happy Hour ตาม id' })
  @ApiParam({ name: 'id', description: 'รหัส slot', example: '1' })
  @ApiBody({ type: UpdateSlotDto })
  @ApiResponse({ status: 200, description: 'แก้ไข slot สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Put('slots/:id')
  updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotDto,
    @Req() req: { user: JwtUser },
  ) {
    return this.happyHourService.updateSlot(id, dto, req.user.username);
  }

  @ApiOperation({ summary: 'ลบ slot ของ Happy Hour ตาม id' })
  @ApiParam({ name: 'id', description: 'รหัส slot', example: '1' })
  @ApiResponse({ status: 204, description: 'ลบ slot สำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Delete('slots/:id')
  @HttpCode(204)
  deleteSlot(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: JwtUser },
  ) {
    return this.happyHourService.deleteSlot(id, req.user.username);
  }

  @ApiOperation({ summary: 'จำลองการคำนวณ Happy Hour ตามยอดสั่งซื้อและเวลาที่กำหนด' })
  @ApiBody({ type: SimulateDto })
  @ApiResponse({ status: 201, description: 'ผลลัพธ์การจำลองการคำนวณ Happy Hour' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('simulate')
  simulate(@Body() dto: SimulateDto) {
    return this.happyHourService.simulate(dto);
  }

  /**
   * POST /admin/happy-hour/cart-preview
   * คำนวณ Happy Hour สำหรับแสดงผลในตะกร้าสินค้า
   * Backend คำนวณทุกอย่าง (scope filtering, reward amounts) — frontend display ตรงได้เลย
   */
  @ApiOperation({
    summary:
      'คำนวณ Happy Hour สำหรับแสดงผลในตะกร้าสินค้า (scope filtering, reward amounts คำนวณฝั่ง backend ทั้งหมด)',
  })
  @ApiBody({ type: CartPreviewDto })
  @ApiResponse({ status: 201, description: 'ผลลัพธ์การคำนวณ Happy Hour สำหรับตะกร้าสินค้า' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Post('cart-preview')
  cartPreview(@Body() dto: CartPreviewDto) {
    return this.happyHourService.getCartPreview(dto);
  }

  @ApiOperation({ summary: 'ดึงรายการบัตร Lotus ที่ใช้เป็นรางวัลใน Happy Hour' })
  @ApiResponse({ status: 200, description: 'รายการบัตร Lotus' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('lotus-cards')
  getLotusCards() {
    return this.happyHourService.getLotusCards();
  }

  /**
   * GET /admin/happy-hour/slot-logs
   * ดึง audit log การ CREATE / UPDATE / DELETE slot พร้อม pagination
   *
   * Query params:
   *   action        — CREATE | UPDATE | DELETE (optional)
   *   slot_id       — กรองตาม slot id (optional)
   *   performed_by  — กรองตาม username (บางส่วนก็ได้)
   *   page          — default 1
   *   limit         — default 20
   */
  @ApiOperation({
    summary: 'ดึง audit log การ CREATE / UPDATE / DELETE slot พร้อม pagination',
  })
  @ApiQuery({ name: 'action', required: false, enum: ['CREATE', 'UPDATE', 'DELETE'], example: 'UPDATE', description: 'Optional; กรองตาม action' })
  @ApiQuery({ name: 'slot_id', required: false, example: '1', description: 'Optional; กรองตาม slot id' })
  @ApiQuery({ name: 'performed_by', required: false, example: 'admin01', description: 'Optional; กรองตาม username (บางส่วนก็ได้)' })
  @ApiQuery({ name: 'page', required: false, example: '1', description: 'Optional; หน้าที่ต้องการ (default 1)' })
  @ApiQuery({ name: 'limit', required: false, example: '20', description: 'Optional; จำนวนรายการต่อหน้า (default 20)' })
  @ApiResponse({ status: 200, description: 'รายการ audit log ของ slot พร้อม pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('slot-logs')
  getSlotLogs(@Query() query: SlotLogQueryDto) {
    return this.happyHourService.getSlotLogs(query);
  }

  /**
   * GET /admin/happy-hour/config-logs
   * ดึง audit log การเปลี่ยน config (UPDATE / TOGGLE) พร้อม pagination
   *
   * Query params:
   *   action        — UPDATE | TOGGLE (optional)
   *   performed_by  — กรองตาม username (บางส่วนก็ได้)
   *   page          — default 1
   *   limit         — default 20
   */
  @ApiOperation({
    summary: 'ดึง audit log การเปลี่ยน config (UPDATE / TOGGLE) พร้อม pagination',
  })
  @ApiQuery({ name: 'action', required: false, enum: ['UPDATE', 'TOGGLE'], example: 'TOGGLE', description: 'Optional; กรองตาม action' })
  @ApiQuery({ name: 'performed_by', required: false, example: 'admin01', description: 'Optional; กรองตาม username (บางส่วนก็ได้)' })
  @ApiQuery({ name: 'page', required: false, example: '1', description: 'Optional; หน้าที่ต้องการ (default 1)' })
  @ApiQuery({ name: 'limit', required: false, example: '20', description: 'Optional; จำนวนรายการต่อหน้า (default 20)' })
  @ApiResponse({ status: 200, description: 'รายการ audit log ของ config พร้อม pagination' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('config-logs')
  getConfigLogs(@Query() query: ConfigLogQueryDto) {
    return this.happyHourService.getConfigLogs(query);
  }

  /**
   * GET /admin/happy-hour/vendors/search?keyword=xxx
   * ค้นหา vendor (creditor) สำหรับ min_order_scope = 'vendor'
   * Response: [{ vendor_code, vendor_name }]
   */
  /**
   * GET /admin/happy-hour/product-units?codes=A001,A002
   * ดึงหน่วยที่เล็กที่สุดของสินค้าหลายตัวพร้อมกัน
   * Response: [{ pro_code, unit }]
   */
  @ApiOperation({ summary: 'ดึงหน่วยที่เล็กที่สุดของสินค้าหลายตัวพร้อมกัน' })
  @ApiQuery({
    name: 'codes',
    required: false,
    example: 'A001,A002',
    description: "Optional; รหัสสินค้าหลายตัวคั่นด้วย comma เช่น 'A001,A002'",
  })
  @ApiResponse({ status: 200, description: 'รายการ [{ pro_code, unit }]' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('product-units')
  getProductUnits(@Query('codes') codes: string) {
    const list = codes ? codes.split(',').map((c) => c.trim()).filter(Boolean) : [];
    return this.happyHourService.getProductUnits(list);
  }

  /**
   * GET /admin/happy-hour/vendors/search?keyword=xxx
   * ค้นหา vendor (creditor) สำหรับ min_order_scope = 'vendor'
   * Response: [{ vendor_code, vendor_name }]
   */
  @ApiOperation({ summary: "ค้นหา vendor (เจ้าหนี้) สำหรับ min_order_scope = 'vendor'" })
  @ApiQuery({ name: 'keyword', required: false, example: 'บริษัท ยา', description: 'Optional; คำค้นหาชื่อ/รหัส vendor' })
  @ApiResponse({ status: 200, description: 'รายการ [{ vendor_code, vendor_name }]' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('vendors/search')
  searchVendors(@Query('keyword') keyword: string) {
    return this.happyHourService.searchVendors(keyword ?? '');
  }

  /**
   * GET /admin/happy-hour/vendors/products?vendor_code=xxx
   * ดึงรายการสินค้าทั้งหมดของเจ้าหนี้ที่ระบุ (ใช้ query param เพราะ vendor_code อาจมี '/')
   * Response: [{ pro_code, pro_name }]
   */
  @ApiOperation({
    summary: "ดึงรายการสินค้าทั้งหมดของเจ้าหนี้ (vendor) ที่ระบุ (ใช้ query param เพราะ vendor_code อาจมี '/')",
  })
  @ApiQuery({ name: 'vendor_code', required: false, example: 'V001', description: 'Optional; รหัสเจ้าหนี้/vendor' })
  @ApiResponse({ status: 200, description: 'รายการ [{ pro_code, pro_name }]' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @Get('vendors/products')
  getVendorProducts(@Query('vendor_code') vendorCode: string) {
    return this.happyHourService.getVendorProducts(vendorCode ?? '');
  }
}
