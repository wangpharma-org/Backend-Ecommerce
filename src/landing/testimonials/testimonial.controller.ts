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
import { TestimonialService } from './testimonial.service';
import { TestimonialEntity } from './testimonial.entity';

@Controller('ecom')
export class TestimonialController {
  constructor(private readonly testimonialService: TestimonialService) {}

  // Public: Get all active testimonials
  @Get('landing/testimonials')
  async getActiveTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialService.getActiveTestimonials();
  }

  // Admin: Get all testimonials
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/testimonials')
  async getAllTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialService.getAllTestimonials();
  }

  // Admin: Get testimonial by ID
  @UseGuards(JwtAuthGuard)
  @Get('admin/landing/testimonials/:id')
  async getTestimonialById(@Param('id') id: string): Promise<TestimonialEntity | null> {
    return this.testimonialService.getTestimonialById(+id);
  }

  // Admin: Create testimonial
  @UseGuards(JwtAuthGuard)
  @Post('admin/landing/testimonials')
  async createTestimonial(
    @Body() data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity> {
    return this.testimonialService.createTestimonial(data);
  }

  // Admin: Update testimonial
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/:id')
  async updateTestimonial(
    @Param('id') id: string,
    @Body() data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity | null> {
    return this.testimonialService.updateTestimonial(+id, data);
  }

  // Admin: Delete testimonial
  @UseGuards(JwtAuthGuard)
  @Delete('admin/landing/testimonials/:id')
  async deleteTestimonial(@Param('id') id: string): Promise<void> {
    return this.testimonialService.deleteTestimonial(+id);
  }

  // Admin: Toggle testimonial status
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/:id/toggle')
  async toggleTestimonialStatus(
    @Param('id') id: string,
  ): Promise<TestimonialEntity | null> {
    return this.testimonialService.toggleTestimonialStatus(+id);
  }

  // Admin: Reorder testimonials
  @UseGuards(JwtAuthGuard)
  @Put('admin/landing/testimonials/reorder')
  async reorderTestimonials(@Body() body: { ids: number[] }): Promise<void> {
    return this.testimonialService.reorderTestimonials(body.ids);
  }
}
