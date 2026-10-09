import {
  Body,
  Controller,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DhlTrackingService } from './dhl-tracking.service';
import { UpsertDhlTrackingDto } from './dto/upsert-dhl-tracking.dto';

@Controller('ecom/external/dhl-tracking')
@UseGuards(JwtAuthGuard)
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class DhlTrackingController {
  constructor(private readonly dhlTrackingService: DhlTrackingService) {}

  /**
   * รับหมายเลขพัสดุ DHL จากระบบภายนอก โดยอ้างอิงคำสั่งจองด้วย soh_running
   * ส่งข้อมูลเดิมซ้ำได้อย่างปลอดภัย และหนึ่งคำสั่งจองเก็บได้หลายเลขพัสดุ
   */
  @Post()
  async upsert(@Body() dto: UpsertDhlTrackingDto) {
    return this.dhlTrackingService.upsert(dto);
  }
}
