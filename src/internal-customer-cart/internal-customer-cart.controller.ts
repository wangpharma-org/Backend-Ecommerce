import {
  BadRequestException,
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { InternalCustomerCartService } from './internal-customer-cart.service';

/// ให้ระบบขาย (Key ขาย) ดูของที่ร้านค้างไว้ในตะกร้า e-commerce — x-internal-token เท่านั้น
@Controller()
export class InternalCustomerCartController {
  constructor(private readonly service: InternalCustomerCartService) {}

  @UseGuards(InternalTokenGuard)
  @Get('/ecom/internal/customer-cart/:mem_code')
  async getCustomerCart(@Param('mem_code') memCode: string) {
    const code = (memCode ?? '').trim();
    if (!code || code.length > 30)
      throw new BadRequestException('mem_code ไม่ถูกต้อง');
    return this.service.getCart(code);
  }
}
