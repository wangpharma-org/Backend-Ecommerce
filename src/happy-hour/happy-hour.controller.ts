import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
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
import { HappyHourService } from './happy-hour.service';
import { CreateSlotDto } from './dto/create-slot.dto';
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
  constructor(private readonly happyHourService: HappyHourService) {}

  @Get('config')
  getConfig() {
    return this.happyHourService.getConfig();
  }

  @Patch('toggle')
  toggle(@Req() req: { user: JwtUser }) {
    if (req.user.permission === false && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    console.log(`User ${req.user.username} is toggling happy hour`, {
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
    if (req.user.permission === false && req.user.role !== 'admin') {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
    return this.happyHourService.createSlot(dto);
  }

  @Put('slots/:id')
  updateSlot(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateSlotDto>,
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
}
