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
import { HappyHourService } from './happy-hour.service';
import { CreateSlotDto } from './dto/create-slot.dto';
import { UpdateSlotDto } from './dto/update-slot.dto';
import { UpdateConfigDto } from './dto/update-config.dto';
import { SimulateDto } from './dto/simulate.dto';
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
  @Get('overview')
  async getOverview() {
    const [config, slots] = await Promise.all([
      this.happyHourService.getConfigResponse(),
      this.happyHourService.getSlots(),
    ]);
    return { config, slots };
  }

  @Get('config')
  getConfig() {
    return this.happyHourService.getConfigResponse();
  }

  @Patch('config')
  updateConfig(@Body() dto: UpdateConfigDto, @Req() req: { user: JwtUser }) {
    this.logger.log(`User ${req.user.username} is updating happy hour config`, {
      is_enabled: dto.is_enabled,
    });
    return this.happyHourService.updateConfig(dto, req.user.username);
  }

  @Patch('toggle')
  toggle(@Req() req: { user: JwtUser }) {
    this.logger.log(`User ${req.user.username} is toggling happy hour`, {
      mem_code: req.user.mem_code,
      role: req.user.role,
      permission: req.user.permission,
    });
    return this.happyHourService.toggle(req.user.username);
  }

  @Get('slots')
  getSlots() {
    return this.happyHourService.getSlots();
  }

  @Post('slots')
  createSlot(@Body() dto: CreateSlotDto, @Req() req: { user: JwtUser }) {
    return this.happyHourService.createSlot(dto, req.user.username);
  }

  @Put('slots/:id')
  updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotDto,
    @Req() req: { user: JwtUser },
  ) {
    return this.happyHourService.updateSlot(id, dto, req.user.username);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  deleteSlot(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: { user: JwtUser },
  ) {
    return this.happyHourService.deleteSlot(id, req.user.username);
  }

  @Post('simulate')
  simulate(@Body() dto: SimulateDto) {
    return this.happyHourService.simulate(dto);
  }

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
  @Get('config-logs')
  getConfigLogs(@Query() query: ConfigLogQueryDto) {
    return this.happyHourService.getConfigLogs(query);
  }
}
