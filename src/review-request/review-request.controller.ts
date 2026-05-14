import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewRequestService } from './review-request.service';

class CompleteReviewDto {
  @IsString()
  @IsNotEmpty()
  mem_code!: string;

  @IsArray()
  @IsString({ each: true })
  sh_running!: string[];
}

@Controller('ecom/review-request')
export class ReviewRequestController {
  constructor(private readonly service: ReviewRequestService) {}

  @UseGuards(JwtAuthGuard)
  @Get('pending/:mem_code')
  getPending(@Param('mem_code') memCode: string) {
    return this.service.getPending(memCode);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('complete')
  async complete(@Body() dto: CompleteReviewDto) {
    await this.service.markCompleted(dto.mem_code, dto.sh_running);
    return { success: true };
  }
}
