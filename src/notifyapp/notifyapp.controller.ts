import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { NotifyRtService } from './notifyapp.service';
import { SendAdminNotificationDto } from './dto/send-admin-notification.dto';

interface RequestUser {
  permission?: boolean;
}

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

@Controller('ecom/admin/notifications')
export class NotifyRtController {
  constructor(private readonly notifyRtService: NotifyRtService) {}

  @UseGuards(JwtAuthGuard)
  @Get('filters/provinces')
  async getNotificationProvinces(@Req() req: AuthenticatedRequest) {
    if (req.user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.notifyRtService.getNotificationProvinces();
  }

  @UseGuards(JwtAuthGuard)
  @Get('sms-credit')
  async getSmsCreditBalance(@Req() req: AuthenticatedRequest) {
    if (req.user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.notifyRtService.getSmsCreditBalance();
  }

  @UseGuards(JwtAuthGuard)
  @Post('send')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )
  async sendAdminNotification(
    @Req() req: AuthenticatedRequest,
    @Body() body: SendAdminNotificationDto,
  ) {
    if (req.user?.permission !== true) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return this.notifyRtService.sendAdminNotification(body);
  }
}
