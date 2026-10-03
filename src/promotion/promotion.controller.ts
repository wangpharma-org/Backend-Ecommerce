import {
  Controller,
  ForbiddenException,
  Post,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromotionService } from './promotion.service';
import { UpdatePromotionDatesDto } from './dto/update-promotion-dates.dto';

type AuthenticatedAdminRequest = Request & {
  user: {
    permission?: boolean;
    mem_code: string;
    username: string;
  };
};

@Controller()
export class PromotionController {
  constructor(private readonly promotionService: PromotionService) {}

  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @Post('/ecom/promotion/update-dates')
  async updatePromotionDates(
    @Req() req: AuthenticatedAdminRequest,
    @Body() data: UpdatePromotionDatesDto,
  ) {
    if (req.user.permission !== true) {
      throw new ForbiddenException('Admin permission is required');
    }

    return this.promotionService.updatePromotionDates(data);
  }
}
