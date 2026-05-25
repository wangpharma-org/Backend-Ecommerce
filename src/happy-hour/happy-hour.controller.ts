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

  @Get('config')
  getConfig() {
    return this.happyHourService.getConfig();
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
  createSlot(@Body() dto: CreateSlotDto) {
    return this.happyHourService.createSlot(dto);
  }

  @Put('slots/:id')
  updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSlotDto,
  ) {
    return this.happyHourService.updateSlot(id, dto);
  }

  @Delete('slots/:id')
  @HttpCode(204)
  deleteSlot(@Param('id', ParseIntPipe) id: number) {
    return this.happyHourService.deleteSlot(id);
  }

  @Post('simulate')
  simulate(@Body() dto: SimulateDto) {
    return this.happyHourService.simulate(dto);
  }

  @Get('lotus-cards')
  getLotusCards() {
    return this.happyHourService.getLotusCards();
  }
}
