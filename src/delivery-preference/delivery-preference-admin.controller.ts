import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeliveryPreferenceService } from './delivery-preference.service';

@UseGuards(JwtAuthGuard)
@Controller('admin/delivery-preference')
export class DeliveryPreferenceAdminController {
  constructor(
    private readonly deliveryPreferenceService: DeliveryPreferenceService,
  ) {}

  @Get('customers')
  async listCustomers(
    @Query('keyword') keyword?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.deliveryPreferenceService.listEligibleCustomers({
      keyword,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('stats')
  async getEligibleRouteStats() {
    return this.deliveryPreferenceService.getEligibleRouteStats();
  }
}
