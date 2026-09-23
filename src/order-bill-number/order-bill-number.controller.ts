import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpsertOrderBillNumberDto } from './dto/upsert-order-bill-number.dto';
import { OrderBillNumberService } from './order-bill-number.service';

@Controller('ecom/external/bill-number')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class OrderBillNumberController {
  constructor(
    private readonly orderBillNumberService: OrderBillNumberService,
  ) {}

  /**
   * ECWC-559 — รับเลขบิลจากระบบจัดออเดอร์ (order-picking) อ้างอิงคำสั่งจองด้วย sh_running
   * หนึ่งคำสั่งจองมีเลขบิลเดียว ส่งซ้ำจะทับเลขบิลเดิม
   */
  @Post()
  async upsert(@Body() dto: UpsertOrderBillNumberDto) {
    return this.orderBillNumberService.upsert(dto);
  }
}
