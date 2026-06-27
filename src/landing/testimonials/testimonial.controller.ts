import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TestimonialService } from './testimonial.service';
import { TestimonialEntity } from './testimonial.entity';

@ApiTags('Landing - Testimonials')
@Controller('ecom')
export class TestimonialController {
  constructor(private readonly testimonialService: TestimonialService) {}

  // Public: Get all active testimonials
  @ApiOperation({ summary: 'ดึงรายการคำรับรองที่เปิดใช้งานทั้งหมด (Public)' })
  @ApiResponse({ status: 200, description: 'รายการคำรับรอง', type: [TestimonialEntity] })
  @Get('landing/testimonials')
  async getActiveTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialService.getActiveTestimonials();
  }

  // Admin: Get all testimonials
  @ApiOperation({ summary: 'ดึงรายการคำรับรองทั้งหมด รวมที่ปิดใช้งาน (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'รายการคำรับรองทั้งหมด', type: [TestimonialEntity] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/testimonials')
  async getAllTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialService.getAllTestimonials();
  }

  // Admin: Get testimonial by ID
  @ApiOperation({ summary: 'ดึงข้อมูลคำรับรองตามรหัส (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำรับรอง', example: '1' })
  @ApiResponse({ status: 200, description: 'ข้อมูลคำรับรอง', type: TestimonialEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/testimonials/:id')
  async getTestimonialById(@Param('id') id: string): Promise<TestimonialEntity | null> {
    return this.testimonialService.getTestimonialById(+id);
  }

  // Admin: Create testimonial
  @ApiOperation({ summary: 'สร้างคำรับรองใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อผู้ให้คำรับรอง', example: 'สมหญิง รักดี' },
        company: { type: 'string', description: 'ชื่อบริษัท/ร้าน' },
        position: { type: 'string', description: 'ตำแหน่งของผู้ให้คำรับรอง' },
        content: { type: 'string', description: 'เนื้อหาคำรับรอง', example: 'ใช้งานง่ายและสะดวกมาก' },
        rating: { type: 'number', description: 'คะแนนรีวิว (1-5)', example: 5 },
        avatar_url: { type: 'string', description: 'URL รูปประจำตัว' },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล' },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน' },
      },
      required: ['name', 'content'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างคำรับรองสำเร็จ', type: TestimonialEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/testimonials')
  async createTestimonial(
    @Body() data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity> {
    return this.testimonialService.createTestimonial(data);
  }

  // Admin: Update testimonial
  @ApiOperation({ summary: 'แก้ไขข้อมูลคำรับรอง (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำรับรอง', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'ชื่อผู้ให้คำรับรอง' },
        company: { type: 'string', description: 'ชื่อบริษัท/ร้าน' },
        position: { type: 'string', description: 'ตำแหน่งของผู้ให้คำรับรอง' },
        content: { type: 'string', description: 'เนื้อหาคำรับรอง' },
        rating: { type: 'number', description: 'คะแนนรีวิว (1-5)' },
        avatar_url: { type: 'string', description: 'URL รูปประจำตัว' },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล' },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไขคำรับรองสำเร็จ', type: TestimonialEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/:id')
  async updateTestimonial(
    @Param('id') id: string,
    @Body() data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity | null> {
    return this.testimonialService.updateTestimonial(+id, data);
  }

  // Admin: Delete testimonial
  @ApiOperation({ summary: 'ลบคำรับรอง (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำรับรอง', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบคำรับรองสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/testimonials/:id')
  async deleteTestimonial(@Param('id') id: string): Promise<void> {
    return this.testimonialService.deleteTestimonial(+id);
  }

  // Admin: Toggle testimonial status
  @ApiOperation({ summary: 'สลับสถานะเปิด/ปิดใช้งานคำรับรอง (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำรับรอง', example: '1' })
  @ApiResponse({ status: 200, description: 'สลับสถานะสำเร็จ', type: TestimonialEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/:id/toggle')
  async toggleTestimonialStatus(
    @Param('id') id: string,
  ): Promise<TestimonialEntity | null> {
    return this.testimonialService.toggleTestimonialStatus(+id);
  }

  // Admin: Reorder testimonials
  @ApiOperation({ summary: 'จัดลำดับการแสดงผลคำรับรองใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'รายการรหัสคำรับรองเรียงตามลำดับใหม่',
          example: [3, 1, 2],
        },
      },
      required: ['ids'],
    },
  })
  @ApiResponse({ status: 200, description: 'จัดลำดับสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/reorder')
  async reorderTestimonials(@Body() body: { ids: number[] }): Promise<void> {
    return this.testimonialService.reorderTestimonials(body.ids);
  }
}
