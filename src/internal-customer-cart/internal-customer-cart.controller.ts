import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import {
  CartConsumeLine,
  InternalCustomerCartService,
} from './internal-customer-cart.service';

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

  /// ระบบขายบันทึกใบสั่งจองที่มีบรรทัดจากตะกร้า → ลดของในตะกร้าลูกค้า (ครั้งเดียวต่อ order_ref)
  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/customer-cart/:mem_code/consume')
  @HttpCode(200)
  async consume(
    @Param('mem_code') memCode: string,
    @Body() body: { order_ref?: unknown; lines?: unknown },
  ) {
    const code = this.memCode(memCode);
    const ref = this.orderRef(body?.order_ref);
    if (!Array.isArray(body?.lines) || body.lines.length > 500)
      throw new BadRequestException('lines ต้องเป็นรายการ (ไม่เกิน 500)');
    const lines = body.lines.map((raw: unknown): CartConsumeLine => {
      const l = (raw ?? {}) as Record<string, unknown>;
      const pro = typeof l.pro_code === 'string' ? l.pro_code.trim() : '';
      const qty = Number(l.qty);
      if (!pro || pro.length > 20 || !Number.isFinite(qty) || qty <= 0)
        throw new BadRequestException('แต่ละบรรทัดต้องมี pro_code และ qty > 0');
      const unit =
        typeof l.unit === 'string' && l.unit.trim() ? l.unit.trim() : null;
      return { pro_code: pro, unit, qty };
    });
    return this.service.consume(code, ref, lines);
  }

  /// ระบบขายยกเลิกใบสั่งจองและเลือก "คืนของเข้าตะกร้า" → คืนเฉพาะที่ order_ref นี้เคยลด (ครั้งเดียว)
  @UseGuards(InternalTokenGuard)
  @Post('/ecom/internal/customer-cart/:mem_code/restore')
  @HttpCode(200)
  async restore(
    @Param('mem_code') memCode: string,
    @Body() body: { order_ref?: unknown },
  ) {
    return this.service.restore(
      this.memCode(memCode),
      this.orderRef(body?.order_ref),
    );
  }

  private memCode(raw: string) {
    const code = (raw ?? '').trim();
    if (!code || code.length > 30)
      throw new BadRequestException('mem_code ไม่ถูกต้อง');
    return code;
  }

  private orderRef(raw: unknown) {
    const ref = typeof raw === 'string' ? raw.trim() : '';
    if (!ref || ref.length > 64)
      throw new BadRequestException('ต้องส่ง order_ref (ไม่เกิน 64 ตัวอักษร)');
    return ref;
  }
}
