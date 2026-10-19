import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { InternalTokenGuard } from '../auth/internal-token.guard';
import { MemberLoginBlockService } from './member-login-block.service';
import {
  BlockMemberLoginDto,
  UnblockMemberLoginDto,
} from './dto/member-login-block.dto';

// SSN0-273: sale-backend สั่งระงับ/ยกเลิกระงับการเข้าใช้งานของร้าน — service ภายในเท่านั้น (x-internal-token)
// ลูกค้าไม่มีทางเรียก route นี้ได้ และไม่มีหน้า admin ฝั่ง E-commerce สั่งเอง
@UseGuards(InternalTokenGuard)
@Controller('ecom/internal/members/:mem_code/login-block')
export class MemberLoginBlockController {
  constructor(private readonly loginBlockService: MemberLoginBlockService) {}

  @Get()
  async getStatus(@Param('mem_code') mem_code: string) {
    return this.loginBlockService.getStatus(mem_code);
  }

  @Post()
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async block(
    @Param('mem_code') mem_code: string,
    @Body() dto: BlockMemberLoginDto,
  ) {
    return this.loginBlockService.block(mem_code, dto.reason, dto);
  }

  @Post('unblock')
  @HttpCode(200)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async unblock(
    @Param('mem_code') mem_code: string,
    @Body() dto: UnblockMemberLoginDto,
  ) {
    return this.loginBlockService.unblock(mem_code, dto.reason, dto);
  }
}
