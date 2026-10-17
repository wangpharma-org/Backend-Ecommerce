import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InternalTokenGuard } from 'src/auth/internal-token.guard';
import { CustomerPromotionsService } from './customer-promotions.service';
import type { CustomerPromotionsResponse } from './customer-promotions.types';

/**
 * ให้ระบบขาย (หน้า Key ขาย) เห็นโปรทั้งหมดที่ร้านร่วมได้ — Company Day, Wang Day, Hot Deal, Flash Sale,
 * Happy Hour, Special Collection, Bundle Set และ Wang Rebate ของร้าน (ข้อกำหนด Tim 17 ต.ค. 2569)
 * service-to-service เท่านั้น: header x-internal-token = INTERNAL_API_TOKEN
 */
@Controller()
export class CustomerPromotionsController {
  constructor(private readonly service: CustomerPromotionsService) {}

  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/customer-promotions')
  forCustomer(
    @Query('mem_code') memCode?: string,
    @Query('pro_codes') proCodes?: string,
  ): Promise<CustomerPromotionsResponse> {
    return this.service.forCustomer(memCode, proCodes);
  }
}
