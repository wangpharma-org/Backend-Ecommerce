import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PromotionEntity } from './promotion.entity';
import { Repository, DeepPartial } from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';

@Injectable()
export class PromotionService {
  constructor(
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly promotionTierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly promotionConditionRepo: Repository<PromotionConditionEntity>,
    @InjectRepository(PromotionRewardEntity)
    private readonly promotionRewardRepo: Repository<PromotionRewardEntity>,
  ) {}

  async addPromotion(data: {
    promo_name: string;
    creditor_code: string;
    start_date: Date;
    end_date: Date;
    status: boolean;
  }) {
    try {
      console.log(data);
      const newPromotion = this.promotionRepo.create({
        promo_name: data.promo_name,
        creditor: { creditor_code: data.creditor_code },
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
      });
      await this.promotionRepo.save(newPromotion);
    } catch (error) {
      console.log(error);
      throw new Error(`Failed to add promotion`);
    }
  }

  async getAllPromotions() {
    try {
      return await this.promotionRepo.find();
    } catch {
      throw new Error(`Failed to get promotions`);
    }
  }

  async getPromotionById(promo_id: number) {
    try {
      return await this.promotionRepo.findOne({
        where: { promo_id },
        relations: ['creditor', 'tiers'],
      });
    } catch {
      throw new Error(`Failed to get promotion by id`);
    }
  }

  async addTierToPromotion(data: {
    promo_id: number;
    tier_name: string;
    min_amount: number;
    description?: string;
    tier_postter?: string;
  }) {
    try {
      const promotion = await this.promotionRepo.findOne({
        where: { promo_id: data.promo_id },
      });
      if (!promotion) {
        throw new Error(`Promotion with id ${data.promo_id} not found`);
      }

      const newTier = this.promotionTierRepo.create({
        tier_name: data.tier_name,
        min_amount: data.min_amount,
        description: data.description,
        tier_postter: data.tier_postter,
        promotion: promotion,
      });
      await this.promotionTierRepo.save(newTier);
    } catch {
      throw new Error(`Failed to add tier to promotion`);
    }
  }

  async updateStatus(promo_id: number, status: boolean) {
    try {
      const promotion = await this.promotionRepo.findOne({
        where: { promo_id },
      });
      if (!promotion) {
        throw new Error(`Promotion with id ${promo_id} not found`);
      }
      promotion.status = status;
      await this.promotionRepo.save(promotion);
    } catch {
      throw new Error(`Failed to update promotion status`);
    }
  }

  deleteTier(tier_id: number) {
    try {
      return this.promotionTierRepo.delete({ tier_id });
    } catch {
      throw new Error(`Failed to delete tier`);
    }
  }

  async deletePromotion(promo_id: number) {
    try {
      const promotion = await this.promotionRepo.findOne({
        where: { promo_id },
      });
      if (!promotion) {
        throw new Error(`Promotion with id ${promo_id} not found`);
      }
      await this.promotionRepo.remove(promotion);
    } catch {
      throw new Error(`Failed to delete promotion`);
    }
  }

  async createCondition(data: {
    tier_id: number;
    product_gcode: string;
    qty: number;
    unit: string;
  }) {
    try {
      const newCondition = this.promotionConditionRepo.create({
        tier: { tier_id: data.tier_id },
        product: { pro_code: data.product_gcode },
        qty: data.qty,
        unit: data.unit,
      } as DeepPartial<PromotionConditionEntity>);
      await this.promotionConditionRepo.save(newCondition);
    } catch {
      throw new Error(`Failed to create condition`);
    }
  }

  async deleteCondition(cond_id: number) {
    try {
      return this.promotionConditionRepo.delete({ cond_id });
    } catch {
      throw new Error(`Failed to delete condition`);
    }
  }

  async deleteReward(reward_id: number) {
    try {
      return this.promotionRewardRepo.delete({ reward_id });
    } catch {
      throw new Error(`Failed to delete reward`);
    }
  }

  async createReward(data: {
    tier_id: number;
    product_gcode: string;
    qty: number;
    unit: string;
  }) {
    try {
      const newReward = this.promotionRewardRepo.create({
        tier: { tier_id: data.tier_id },
        giftProduct: { pro_code: data.product_gcode },
        qty: data.qty,
        unit: data.unit,
      } as DeepPartial<PromotionRewardEntity>);
      await this.promotionRewardRepo.save(newReward);
    } catch {
      throw new Error(`Failed to create reward`);
    }
  }

  async getRewardsByTier(tier_id: number) {
    try {
      return await this.promotionRewardRepo.find({
        where: { tier: { tier_id } },
        relations: ['giftProduct'],
      });
    } catch {
      throw new Error(`Failed to get rewards by tier`);
    }
  }

  async getConditionsByTier(tier_id: number) {
    try {
      return await this.promotionConditionRepo.find({
        where: { tier: { tier_id } },
        relations: ['product'],
      });
    } catch {
      throw new Error(`Failed to get conditions by tier`);
    }
  }
}
