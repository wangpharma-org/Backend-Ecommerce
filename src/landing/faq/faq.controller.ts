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
import { FaqService } from './faq.service';
import { FaqEntity } from './faq.entity';

@ApiTags('Landing - FAQ')
@Controller('ecom')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  // Public: Get all active FAQs
  @ApiOperation({ summary: 'ดึงรายการคำถามที่พบบ่อยที่เปิดใช้งานทั้งหมด (Public)' })
  @ApiResponse({ status: 200, description: 'รายการคำถามที่พบบ่อย', type: [FaqEntity] })
  @Get('landing/faqs')
  async getActiveFaqs(): Promise<FaqEntity[]> {
    return this.faqService.getActiveFaqs();
  }

  // Public: Get FAQs by category
  @ApiOperation({ summary: 'ดึงรายการคำถามที่พบบ่อยตามหมวดหมู่ (Public)' })
  @ApiParam({ name: 'category', description: 'ชื่อหมวดหมู่ของคำถาม', example: 'การสมัครสมาชิก' })
  @ApiResponse({ status: 200, description: 'รายการคำถามที่พบบ่อยตามหมวดหมู่', type: [FaqEntity] })
  @Get('landing/faqs/category/:category')
  async getFaqsByCategory(
    @Param('category') category: string,
  ): Promise<FaqEntity[]> {
    return this.faqService.getFaqsByCategory(category);
  }

  // Admin: Get all FAQs
  @ApiOperation({ summary: 'ดึงรายการคำถามที่พบบ่อยทั้งหมด รวมที่ปิดใช้งาน (Admin)' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'รายการคำถามที่พบบ่อยทั้งหมด', type: [FaqEntity] })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/faqs')
  async getAllFaqs(): Promise<FaqEntity[]> {
    return this.faqService.getAllFaqs();
  }

  // Admin: Get FAQ by ID
  @ApiOperation({ summary: 'ดึงข้อมูลคำถามที่พบบ่อยตามรหัส (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำถาม', example: '1' })
  @ApiResponse({ status: 200, description: 'ข้อมูลคำถามที่พบบ่อย', type: FaqEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/faqs/:id')
  async getFaqById(@Param('id') id: string): Promise<FaqEntity | null> {
    return this.faqService.getFaqById(+id);
  }

  // Admin: Create FAQ
  @ApiOperation({ summary: 'สร้างคำถามที่พบบ่อยใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'คำถาม', example: 'สมัครสมาชิกอย่างไร' },
        answer: { type: 'string', description: 'คำตอบ', example: 'กรอกแบบฟอร์มลงทะเบียน' },
        category: { type: 'string', description: 'หมวดหมู่', example: 'การสมัครสมาชิก' },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล', example: 0 },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน', example: true },
      },
      required: ['question', 'answer'],
    },
  })
  @ApiResponse({ status: 201, description: 'สร้างคำถามที่พบบ่อยสำเร็จ', type: FaqEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/faqs')
  async createFaq(@Body() data: Partial<FaqEntity>): Promise<FaqEntity> {
    return this.faqService.createFaq(data);
  }

  // Admin: Update FAQ
  @ApiOperation({ summary: 'แก้ไขคำถามที่พบบ่อย (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำถาม', example: '1' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'คำถาม' },
        answer: { type: 'string', description: 'คำตอบ' },
        category: { type: 'string', description: 'หมวดหมู่' },
        display_order: { type: 'number', description: 'ลำดับการแสดงผล' },
        is_active: { type: 'boolean', description: 'สถานะเปิดใช้งาน' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'แก้ไขคำถามที่พบบ่อยสำเร็จ', type: FaqEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/:id')
  async updateFaq(
    @Param('id') id: string,
    @Body() data: Partial<FaqEntity>,
  ): Promise<FaqEntity | null> {
    return this.faqService.updateFaq(+id, data);
  }

  // Admin: Delete FAQ
  @ApiOperation({ summary: 'ลบคำถามที่พบบ่อย (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำถาม', example: '1' })
  @ApiResponse({ status: 200, description: 'ลบคำถามที่พบบ่อยสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/faqs/:id')
  async deleteFaq(@Param('id') id: string): Promise<void> {
    return this.faqService.deleteFaq(+id);
  }

  // Admin: Toggle FAQ status
  @ApiOperation({ summary: 'สลับสถานะเปิด/ปิดใช้งานคำถามที่พบบ่อย (Admin)' })
  @ApiBearerAuth()
  @ApiParam({ name: 'id', description: 'รหัสของคำถาม', example: '1' })
  @ApiResponse({ status: 200, description: 'สลับสถานะสำเร็จ', type: FaqEntity })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/:id/toggle')
  async toggleFaqStatus(@Param('id') id: string): Promise<FaqEntity | null> {
    return this.faqService.toggleFaqStatus(+id);
  }

  // Admin: Reorder FAQs
  @ApiOperation({ summary: 'จัดลำดับการแสดงผลคำถามที่พบบ่อยใหม่ (Admin)' })
  @ApiBearerAuth()
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'รายการรหัสคำถามเรียงตามลำดับใหม่',
          example: [3, 1, 2],
        },
      },
      required: ['ids'],
    },
  })
  @ApiResponse({ status: 200, description: 'จัดลำดับสำเร็จ' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/reorder')
  async reorderFaqs(@Body() body: { ids: number[] }): Promise<void> {
    return this.faqService.reorderFaqs(body.ids);
  }
}
