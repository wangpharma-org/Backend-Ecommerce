import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PromotionService } from './promotion.service';
import { SetCreditorProductsConditionDto } from './dto/set-creditor-products-condition.dto';

@Controller()
export class PromotionConditionController {
  constructor(private readonly promotionService: PromotionService) {}

  // เพิ่ม/นำออก สินค้าทุกตัวของเจ้าหนี้ในโปร เป็นสินค้าเข้าร่วมรายการของ tier ในคำขอเดียว
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
  @Post('/ecom/promotion/condition/creditor-products')
  async setCreditorProductsCondition(
    @Body() data: SetCreditorProductsConditionDto,
  ) {
    return this.promotionService.setCreditorProductsCondition(
      data.tier_id,
      data.status,
    );
  }
}
