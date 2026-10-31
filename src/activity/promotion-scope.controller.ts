import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from 'src/auth/internal-token.guard';
import {
  PromotionListItem,
  PromotionScope,
  PromotionScopeService,
} from './promotion-scope.service';

/**
 * ให้ sale-backend (dashboard กิจกรรมโปร) รู้ขอบเขตของโปร — รวมโปรที่จบแล้ว
 * service-to-service เท่านั้น: header x-internal-token = INTERNAL_API_TOKEN
 */
@Controller()
export class PromotionScopeController {
  constructor(private readonly service: PromotionScopeService) {}

  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/activity/promotion-scope')
  scope(
    @Query('promo_id') promoId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PromotionScope> {
    return this.service.scope(promoId, from, to);
  }

  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/activity/promotions')
  list(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<PromotionListItem[]> {
    return this.service.list(from, to);
  }
}
