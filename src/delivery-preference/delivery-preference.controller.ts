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
import { DeliveryPreferenceService } from './delivery-preference.service';
import { SetPreferenceDto } from './dto/set-preference.dto';

@UseGuards(JwtAuthGuard)
@Controller('ecom/delivery-preference')
export class DeliveryPreferenceController {
  constructor(
    private readonly deliveryPreferenceService: DeliveryPreferenceService,
  ) {}

  @Get('checkout-options')
  async getCheckoutOptions(@Req() req: Request & { user: JwtPayload }) {
    return this.deliveryPreferenceService.getCheckoutOptions(
      req.user.mem_code,
      req.user.mem_route,
    );
  }

  @Put('preference')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async setPreference(
    @Req() req: Request & { user: JwtPayload },
    @Body() dto: SetPreferenceDto,
  ) {
    return this.deliveryPreferenceService.setCustomerPreference(
      req.user.mem_code,
      req.user.mem_route,
      dto.preference,
    );
  }
}
