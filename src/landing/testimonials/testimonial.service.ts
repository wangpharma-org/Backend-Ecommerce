import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TestimonialEntity } from './testimonial.entity';

@Injectable()
export class TestimonialService {
  constructor(
    @InjectRepository(TestimonialEntity)
    private readonly testimonialRepo: Repository<TestimonialEntity>,
  ) {}

  // Public: Get all active testimonials
  async getActiveTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialRepo.find({
      where: { is_active: true },
      order: { display_order: 'ASC', created_at: 'DESC' },
    });
  }

  // Admin: Get all testimonials
  async getAllTestimonials(): Promise<TestimonialEntity[]> {
    return this.testimonialRepo.find({
      order: { display_order: 'ASC', created_at: 'DESC' },
    });
  }

  // Admin: Get testimonial by ID
  async getTestimonialById(id: number): Promise<TestimonialEntity | null> {
    return this.testimonialRepo.findOne({ where: { id } });
  }

  // Admin: Create testimonial
  async createTestimonial(
    data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity> {
    const testimonial = this.testimonialRepo.create(data);
    return this.testimonialRepo.save(testimonial);
  }

  // Admin: Update testimonial
  async updateTestimonial(
    id: number,
    data: Partial<TestimonialEntity>,
  ): Promise<TestimonialEntity | null> {
    await this.testimonialRepo.update(id, data);
    return this.getTestimonialById(id);
  }

  // Admin: Delete testimonial
  async deleteTestimonial(id: number): Promise<void> {
    await this.testimonialRepo.delete(id);
  }

  // Admin: Toggle testimonial active status
  async toggleTestimonialStatus(id: number): Promise<TestimonialEntity | null> {
    const testimonial = await this.getTestimonialById(id);
    if (testimonial) {
      testimonial.is_active = !testimonial.is_active;
      return this.testimonialRepo.save(testimonial);
    }
    return null;
  }

  // Admin: Reorder testimonials
  async reorderTestimonials(ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.testimonialRepo.update(ids[i], { display_order: i });
    }
  }
}
