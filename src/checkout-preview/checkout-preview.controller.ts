import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalTokenGuard } from 'src/auth/internal-token.guard';
import { parseCheckoutPreviewInput } from './checkout-preview.input';
import { CheckoutPreviewService } from './checkout-preview.service';

@Controller()
export class CheckoutPreviewController {
  constructor(private readonly service: CheckoutPreviewService) {}

  // ระบบขายถามของแถมอัตโนมัติ (Company Day/Wang Day/Hot Deal/Happy Hour) + แต้ม + ตรวจของแลกแต้ม
  // ของรายการสินค้าในใบที่เซลส์คีย์ — กติกาเดียวกับตะกร้าของลูกค้า ไม่แตะตะกร้า ไม่บันทึก
  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/checkout-preview')
  @HttpCode(200)
  async preview(@Body() body: unknown) {
    const input = parseCheckoutPreviewInput(body);
    if (!input) {
      throw new BadRequestException(
        'body ต้องมี mem_code และ lines [{ pro_code, unit, qty > 0 }] (ไม่เกิน 300) · redeem [{ pro_code, amount จำนวนเต็ม ≥ 1 }]',
      );
    }
    return this.service.preview(input);
  }
}
