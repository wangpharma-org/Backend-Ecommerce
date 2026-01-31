import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PartnerEntity } from './partner.entity';

@Injectable()
export class PartnerService {
  constructor(
    @InjectRepository(PartnerEntity)
    private readonly partnerRepo: Repository<PartnerEntity>,
  ) {}

  // Public: Get all active partners
  async getActivePartners(): Promise<PartnerEntity[]> {
    return this.partnerRepo.find({
      where: { is_active: true },
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  // Public: Get partners by category
  async getPartnersByCategory(category: string): Promise<PartnerEntity[]> {
    return this.partnerRepo.find({
      where: { is_active: true, category },
      order: { display_order: 'ASC' },
    });
  }

  // Admin: Get all partners
  async getAllPartners(): Promise<PartnerEntity[]> {
    return this.partnerRepo.find({
      order: { display_order: 'ASC', name: 'ASC' },
    });
  }

  // Admin: Get partner by ID
  async getPartnerById(id: number): Promise<PartnerEntity | null> {
    return this.partnerRepo.findOne({ where: { id } });
  }

  // Admin: Create partner
  async createPartner(data: Partial<PartnerEntity>): Promise<PartnerEntity> {
    const partner = this.partnerRepo.create(data);
    return this.partnerRepo.save(partner);
  }

  // Admin: Update partner
  async updatePartner(
    id: number,
    data: Partial<PartnerEntity>,
  ): Promise<PartnerEntity | null> {
    await this.partnerRepo.update(id, data);
    return this.getPartnerById(id);
  }

  // Admin: Delete partner
  async deletePartner(id: number): Promise<void> {
    await this.partnerRepo.delete(id);
  }

  // Admin: Toggle partner active status
  async togglePartnerStatus(id: number): Promise<PartnerEntity | null> {
    const partner = await this.getPartnerById(id);
    if (partner) {
      partner.is_active = !partner.is_active;
      return this.partnerRepo.save(partner);
    }
    return null;
  }

  // Admin: Reorder partners
  async reorderPartners(ids: number[]): Promise<void> {
    for (let i = 0; i < ids.length; i++) {
      await this.partnerRepo.update(ids[i], { display_order: i });
    }
  }
}
