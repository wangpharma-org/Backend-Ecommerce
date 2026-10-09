import {
  Body,
  Controller,
  Get,
  Put,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayload } from '../app.controller';
import { StoreVisibilityService } from './store-visibility.service';
import { SetStoreVisibilityDto } from './dto/set-store-visibility.dto';

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
    );
  }
}
