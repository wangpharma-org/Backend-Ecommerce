import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FaqEntity } from './faq.entity';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(FaqEntity)
    private readonly faqRepo: Repository<FaqEntity>,
  ) {}

  // Public: Get all active FAQs
  async getActiveFaqs(): Promise<FaqEntity[]> {
    return this.faqRepo.find({
      where: { is_active: true },
      order: { display_order: 'ASC', created_at: 'DESC' },
    });
  }

  // Public: Get FAQs by category
  async getFaqsByCategory(category: string): Promise<FaqEntity[]> {
    return this.faqRepo.find({
      where: { is_active: true, category },
      order: { display_order: 'ASC' },
    });
  }

  // Admin: Get all FAQs
  async getAllFaqs(): Promise<FaqEntity[]> {
    return this.faqRepo.find({
      order: { display_order: 'ASC', created_at: 'DESC' },
    });
  }

  // Admin: Get FAQ by ID
  async getFaqById(id: number): Promise<FaqEntity | null> {
    return this.faqRepo.findOne({ where: { id } });
  }

  // Admin: Create FAQ
  async createFaq(data: Partial<FaqEntity>): Promise<FaqEntity> {
    const faq = this.faqRepo.create(data);
    return this.faqRepo.save(faq);
  }

  // Admin: Update FAQ
  async updateFaq(id: number, data: Partial<FaqEntity>): Promise<FaqEntity | null> {
    await this.faqRepo.update(id, data);
    return this.getFaqById(id);
  }

  // Admin: Delete FAQ
  async deleteFaq(id: number): Promise<void> {
    await this.faqRepo.delete(id);
  }

  // Admin: Toggle FAQ active status
  async toggleFaqStatus(id: number): Promise<FaqEntity | null> {
    const faq = await this.getFaqById(id);
    if (faq) {
      faq.is_active = !faq.is_active;
      return this.faqRepo.save(faq);
    }
    return null;
  }

  // Admin: Reorder FAQs
  async reorderFaqs(ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.faqRepo.update(ids[i], { display_order: i });
    }
  }
}
