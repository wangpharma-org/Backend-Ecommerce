import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { SpecialCollectionService } from './special-collection.service';
import { PromoBoardService } from './promo-board.service';
import { CartBasketService } from './cart-basket.service';
import { CreateBasketDto } from './dto/create-basket.dto';
import { CreateSetBasketDto } from './dto/create-set-basket.dto';
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
    private readonly promoBoardService: PromoBoardService,
    private readonly cartBasketService: CartBasketService,
  ) {}

  /** กระเช้าที่อยู่ในตะกร้าแล้ว — ส่ง promo_id มาเพื่อกรองเฉพาะโปรนั้น */
  @Get('basket')
  listBaskets(
    @Req() req: { user: JwtUser },
    @Query('promo_id') promoId?: string,
  ) {
    const parsed = Number(promoId);
    return this.cartBasketService.listBaskets(
      req.user.mem_code,
      toPriceOption(req.user.price_option),
      Number.isInteger(parsed) && parsed > 0 ? parsed : undefined,
    );
  }

  /** ยืนยันกระเช้าจากหน้า board เข้าตะกร้าทั้งก้อน */
  @Post('basket')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  createBasket(@Body() dto: CreateBasketDto, @Req() req: { user: JwtUser }) {
    return this.cartBasketService.createBasket(
      req.user.mem_code,
      dto.promo_id,
      dto.lines,
      toPriceOption(req.user.price_option),
    );
  }

  /** กระเช้าสำเร็จรูป (bundle_set) เข้าตะกร้าทั้งชุดในราคาชุด */
  @Post('basket/set')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  createSetBasket(
    @Body() dto: CreateSetBasketDto,
    @Req() req: { user: JwtUser },
  ) {
    return this.cartBasketService.createSetBasket(
      req.user.mem_code,
      dto.set_code,
      dto.qty,
      toPriceOption(req.user.price_option),
    );
  }

  /**
   * เอาสินค้าออกจากกระเช้า 1 รายการ
   * ถ้าเอาออกแล้วต่ำกว่าเกณฑ์จะยังไม่ลบ แต่คืน needs_confirm ให้หน้าบ้านถามก่อน
   * แล้วเรียกซ้ำด้วย confirm=true เพื่อยกออกทั้งกระเช้า
   */
  @Delete('basket/:basketId/line/:spcId')
  removeBasketLine(
    @Param('basketId', ParseIntPipe) basketId: number,
    @Param('spcId', ParseIntPipe) spcId: number,
    @Req() req: { user: JwtUser },
    @Query('confirm') confirm?: string,
  ) {
    return this.cartBasketService.removeLine(
      req.user.mem_code,
      basketId,
      spcId,
      confirm === 'true',
      toPriceOption(req.user.price_option),
    );
  }

  @Delete('basket/:basketId')
  deleteBasket(
    @Param('basketId', ParseIntPipe) basketId: number,
    @Req() req: { user: JwtUser },
  ) {
    return this.cartBasketService.deleteBasket(
      req.user.mem_code,
      basketId,
      toPriceOption(req.user.price_option),
    );
  }

  /**
   * ข้อมูลทั้งหมดของโปรหนึ่งตัวในครั้งเดียว สำหรับหน้า board
   * โปร + เซต + ของแถม + สินค้าร่วมรายการ (dedupe) + ความคืบหน้าจากตะกร้าจริง
   */
  @Get('promo-board/:promoId')
  getPromoBoard(
    @Param('promoId', ParseIntPipe) promoId: number,
    @Req() req: { user: JwtUser },
  ) {
    return this.promoBoardService.getBoard(
      promoId,
      req.user.mem_code,
      toPriceOption(req.user.price_option),
    );
  }

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
