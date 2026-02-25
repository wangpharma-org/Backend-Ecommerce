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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { FaqService } from './faq.service';
import { FaqEntity } from './faq.entity';

@Controller('ecom')
export class FaqController {
  constructor(private readonly faqService: FaqService) {}

  // Public: Get all active FAQs
  @Get('landing/faqs')
  async getActiveFaqs(): Promise<FaqEntity[]> {
    return this.faqService.getActiveFaqs();
  }

  // Public: Get FAQs by category
  @Get('landing/faqs/category/:category')
  async getFaqsByCategory(
    @Param('category') category: string,
  ): Promise<FaqEntity[]> {
    return this.faqService.getFaqsByCategory(category);
  }

  // Admin: Get all FAQs
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/faqs')
  async getAllFaqs(): Promise<FaqEntity[]> {
    return this.faqService.getAllFaqs();
  }

  // Admin: Get FAQ by ID
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/faqs/:id')
  async getFaqById(@Param('id') id: string): Promise<FaqEntity | null> {
    return this.faqService.getFaqById(+id);
  }

  // Admin: Create FAQ
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/faqs')
  async createFaq(@Body() data: Partial<FaqEntity>): Promise<FaqEntity> {
    return this.faqService.createFaq(data);
  }

  // Admin: Update FAQ
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/:id')
  async updateFaq(
    @Param('id') id: string,
    @Body() data: Partial<FaqEntity>,
  ): Promise<FaqEntity | null> {
    return this.faqService.updateFaq(+id, data);
  }

  // Admin: Delete FAQ
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/faqs/:id')
  async deleteFaq(@Param('id') id: string): Promise<void> {
    return this.faqService.deleteFaq(+id);
  }

  // Admin: Toggle FAQ status
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/:id/toggle')
  async toggleFaqStatus(@Param('id') id: string): Promise<FaqEntity | null> {
    return this.faqService.toggleFaqStatus(+id);
  }

  // Admin: Reorder FAQs
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/faqs/reorder')
  async reorderFaqs(@Body() body: { ids: number[] }): Promise<void> {
    return this.faqService.reorderFaqs(body.ids);
  }
}
