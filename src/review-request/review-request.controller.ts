import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewRequestService } from './review-request.service';

class CompleteReviewDto {
  @ApiProperty({ description: 'รหัสสมาชิก (mem_code)', example: 'M00001' })
  @IsString()
  @IsNotEmpty()
  mem_code!: string;

  @ApiProperty({
    description: 'รายการเลขที่ออเดอร์/บิล (sh_running) ที่ทำการรีวิวเสร็จสิ้นแล้ว',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  sh_running!: string[];
}

@ApiTags('Review Request')
@ApiBearerAuth()
@Controller('ecom/review-request')
export class ReviewRequestController {
  constructor(private readonly service: ReviewRequestService) {}

  @ApiOperation({ summary: 'ดึงรายการคำขอรีวิวที่ยังไม่เสร็จสิ้นของสมาชิก' })
  @ApiParam({ name: 'mem_code', description: 'รหัสสมาชิก (mem_code)' })
  @ApiResponse({ status: 200, description: 'รายการคำขอรีวิวที่ยังค้างอยู่' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('pending/:mem_code')
  getPending(@Param('mem_code') memCode: string) {
    return this.service.getPending(memCode);
  }

  @ApiOperation({ summary: 'ทำเครื่องหมายคำขอรีวิวว่าเสร็จสิ้นแล้วสำหรับออเดอร์ที่ระบุ' })
  @ApiBody({ type: CompleteReviewDto })
  @ApiResponse({ status: 200, description: 'ทำเครื่องหมายเสร็จสิ้นสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Patch('complete')
  async complete(@Body() dto: CompleteReviewDto) {
    await this.service.markCompleted(dto.mem_code, dto.sh_running);
    return { success: true };
  }
}
