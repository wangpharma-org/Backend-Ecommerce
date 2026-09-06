import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SpecialCollectionService } from './special-collection.service';
import type { PriceOption } from '../bundle-set/bundle-set.service';

interface JwtUser {
  username: string;
  mem_code: string;
  price_option?: string;
}

/** price_option ในโทเคนอาจเป็นตัวเล็กหรือค่าว่าง — normalize ก่อนใช้ */
const toPriceOption = (raw: string | undefined): PriceOption => {
  const upper = (raw ?? '').toUpperCase();
  return upper === 'A' || upper === 'B' || upper === 'C' ? upper : 'C';
};

/**
 * หน้าบ้าน — ชุดสินค้าพิเศษที่ร้านนี้ร่วมรายการ
 * mem_code อ่านจาก token เท่านั้น ไม่รับจาก query เพื่อกันร้านหนึ่งดูของอีกร้าน
 */
@Controller('ecom/special-collection')
@UseGuards(JwtAuthGuard)
export class SpecialCollectionCustomerController {
  constructor(
    private readonly specialCollectionService: SpecialCollectionService,
  ) {}

  /** ทุกคอลเลกชัน + รายการที่ resolve แล้ว สำหรับหน้ารวมโปร */
  @Get('my')
  getMine(@Req() req: { user: JwtUser }) {
    return this.specialCollectionService.getForMember(
      req.user.mem_code,
      toPriceOption(req.user.price_option),
    );
  }

  /** ตัวเลขบน badge ข้างไอคอนของขวัญ */
  @Get('my/badge')
  getBadge(@Req() req: { user: JwtUser }) {
    return this.specialCollectionService.getBadgeCount(
      req.user.mem_code,
      toPriceOption(req.user.price_option),
    );
  }
}
