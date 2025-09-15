import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { PromotionEntity } from './promotion.entity';
import {
  Repository,
  DeepPartial,
  LessThan,
  MoreThanOrEqual,
  LessThanOrEqual,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import * as AWS from 'aws-sdk';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { CodePromotionEntity } from './code-promotion.entity';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class PromotionService {
  private s3: AWS.S3;
  constructor(
    @InjectRepository(PromotionEntity)
    private readonly promotionRepo: Repository<PromotionEntity>,
    @InjectRepository(CodePromotionEntity)
    private readonly codeRepo: Repository<CodePromotionEntity>,
    @InjectRepository(ShoppingCartEntity)
    private readonly cartRepo: Repository<ShoppingCartEntity>,
    @InjectRepository(PromotionTierEntity)
    private readonly promotionTierRepo: Repository<PromotionTierEntity>,
    @InjectRepository(PromotionConditionEntity)
    private readonly promotionConditionRepo: Repository<PromotionConditionEntity>,
    @InjectRepository(PromotionRewardEntity)
    private readonly promotionRewardRepo: Repository<PromotionRewardEntity>,
    private readonly shoppingCartService: ShoppingCartService,
    private readonly authService: AuthService,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  //   @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  @Cron(CronExpression.EVERY_30_SECONDS)
  async cronDeletePromotionOutOfDate() {
    try {
      const today = new Date();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const promo = await this.promotionRepo.find({
        where: { end_date: LessThan(today) },
      });
      if (promo.length === 0) return;

      await this.cartRepo.delete({
        reward_expire: LessThanOrEqual(today),
      });

      await Promise.all(
        promo.map(async (p) => {
          await this.promotionRepo.update(p.promo_id, { status: false });
          await this.cartRepo.update(
            {
              use_code: false,
              promo_id: p.promo_id,
            },
            {
              spc_checked: false,
              reward_expire: tomorrow,
            },
          );
        }),
      );
    } catch {
      throw new Error('Something Error in Delete Promotion');
    }
  }

  async generateCodePromotion(mem_code: string) {
    try {
      const member = await this.authService.fetchUserData(mem_code);
      if (!member) {
        throw new Error('Member not found');
      }
      const code_text = Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase();
      const newCode = this.codeRepo.create({
        code_text,
        mem_code,
      });
      await this.codeRepo.save(newCode);
      return code_text;
    } catch (error) {
      console.error(error);
      throw new Error('Failed to generate promotion code');
    }
  }

  async checkedRewardInCartByCode(
    code_text: string,
    mem_code: string,
    price_option: string,
  ) {
    try {
      const code = await this.codeRepo.findOne({
        where: { code_text },
      });
      if (!code) {
        throw new Error('This code is not found');
      }
      if (code?.mem_code !== mem_code) {
        throw new Error('This code is not for this member');
      }
      await this.cartRepo.update(
        { mem_code, is_reward: true, spc_checked: false },
        {
          spc_checked: true,
          use_code: true,
        },
      );

      await this.codeRepo.delete(code.code_id);

      await this.shoppingCartService.checkPromotionReward(
        mem_code,
        price_option,
      );
    } catch (error) {
      console.error(error);
      throw new Error('Failed to check reward in cart');
    }
  }

  async tierProducts(data: { tier_id: number; mem_code: string }) {
    try {
      const tier = await this.promotionTierRepo.findOne({
        where: {
          tier_id: data.tier_id,
          promotion: {
            status: true,
            start_date: LessThanOrEqual(new Date()),
            end_date: MoreThanOrEqual(new Date()),
          },
        },
        relations: {
          conditions: { product: { inCarts: true } },
        },
        select: {
          tier_id: true,
          tier_name: true,
          min_amount: true,
          description: true,
          tier_postter: true,
          conditions: {
            cond_id: true,
            product: {
              pro_code: true,
              pro_name: true,
              pro_priceA: true,
              pro_priceB: true,
              pro_priceC: true,
              pro_imgmain: true,
              pro_unit1: true,
              pro_unit2: true,
              pro_unit3: true,
              pro_promotion_amount: true,
              pro_promotion_month: true,
              inCarts: {
                mem_code: true,
                spc_amount: true,
                spc_unit: true,
              },
            },
          },
        },
      });

      if (!tier) return null;

      tier.conditions = tier.conditions.map((cond) => ({
        ...cond,
        product: {
          ...cond.product,
          inCarts:
            cond.product.inCarts?.filter(
              (cart) => cart.mem_code === data.mem_code,
            ) ?? [],
        },
      }));

      return tier;
    } catch {
      throw new Error(`Failed to get tier products`);
    }
  }

  async getAllTiers() {
    const Today = new Date();
    try {
      return await this.promotionTierRepo.find({
        where: {
          promotion: {
            status: true,
            start_date: LessThanOrEqual(Today),
            end_date: MoreThanOrEqual(Today),
          },
        },
      });
    } catch {
      throw new Error(`Failed to get tiers`);
    }
  }

  async getAllTiersProduct(): Promise<string[]> {
    try {
      const Today = new Date();
      const tiers = await this.promotionTierRepo.find({
        where: {
          promotion: {
            status: true,
            start_date: LessThanOrEqual(Today),
            end_date: MoreThanOrEqual(Today),
          },
        },
        relations: {
          conditions: { product: true },
        },
        select: {
          tier_id: true,
          conditions: {
            cond_id: true,
            product: {
              pro_code: true,
            },
          },
        },
      });

      const proCodes = tiers.flatMap((tier) =>
        tier.conditions.map((c) => c.product.pro_code),
      );

      return proCodes;
    } catch {
      throw new Error(`Failed to get tiers`);
    }
  }

  async getTierOneById(tier_id: number) {
    try {
      return await this.promotionTierRepo.findOne({
        where: { tier_id },
      });
    } catch {
      throw new Error(`Failed to get tier by id`);
    }
  }

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
      return await this.promotionRepo.find({
        relations: {
          creditor: true,
        },
        select: {
          promo_id: true,
          promo_name: true,
          start_date: true,
          end_date: true,
          status: true,
          creditor: {
            creditor_code: true,
            creditor_name: true,
          },
        },
      });
    } catch {
      throw new Error(`Failed to get promotions`);
    }
  }

  async getPromotionById(promo_id: number) {
    try {
      return await this.promotionRepo.findOne({
        where: { promo_id },
        relations: ['creditor', 'tiers', 'tiers.conditions', 'tiers.rewards'],
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
    file: Express.Multer.File;
  }) {
    console.log(data);
    try {
      const promotion = await this.promotionRepo.findOne({
        where: { promo_id: data.promo_id },
      });
      if (!promotion) {
        throw new Error(`Promotion with id ${data.promo_id} not found`);
      }

      if (!data.file) {
        throw new Error('Something Error in Upload Tier Poster');
      }

      const params = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}-${data.file?.originalname}`,
        Body: data?.file?.buffer,
        ContentType: data?.file?.mimetype,
        ACL: 'public-read',
      };

      const imgData = await this.s3.upload(params).promise();

      const newTier = this.promotionTierRepo.create({
        tier_name: data.tier_name,
        min_amount: data.min_amount,
        description: data.description,
        promotion: promotion,
        tier_postter: imgData.Location,
      });
      await this.promotionTierRepo.save(newTier);
    } catch (error) {
      console.log(error);
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

  async createCondition(data: { tier_id: number; product_gcode: string }) {
    try {
      const newCondition = this.promotionConditionRepo.create({
        tier: { tier_id: data.tier_id },
        product: { pro_code: data.product_gcode },
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

  async editReward(data: { reward_id: number; qty: number; unit: string }) {
    try {
      await this.promotionRewardRepo.update(data.reward_id, {
        qty: data.qty,
        unit: data.unit,
      });
      return 'Reward updated successfully';
    } catch (error) {
      console.error(error);
      throw new Error('Failed to update reward');
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
        relations: { giftProduct: true },
        select: {
          reward_id: true,
          qty: true,
          unit: true,
          giftProduct: {
            pro_code: true,
            pro_name: true,
            pro_genericname: true,
            pro_unit1: true,
            pro_unit2: true,
            pro_unit3: true,
          },
        },
      });
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to get rewards by tier`);
    }
  }

  async getConditionsByTier(tier_id: number) {
    try {
      return await this.promotionConditionRepo.find({
        where: { tier: { tier_id } },
        relations: { product: true },
        select: {
          cond_id: true,
          product: {
            pro_code: true,
          },
        },
      });
    } catch {
      throw new Error(`Failed to get conditions by tier`);
    }
  }

  async updatePromotion(data: {
    promo_id: number;
    promo_name?: string;
    start_date?: Date;
    end_date?: Date;
    status?: boolean;
  }) {
    try {
      await this.promotionRepo.update(data.promo_id, {
        promo_name: data.promo_name,
        start_date: data.start_date,
        end_date: data.end_date,
        status: data.status,
      });
      return 'Promotion updated successfully';
    } catch (error) {
      console.error(error);
      throw new Error('Failed to update promotion');
    }
  }

  async updateTier(data: {
    tier_id: number;
    tier_name?: string;
    min_amount?: number;
    description?: string;
  }) {
    try {
      await this.promotionTierRepo.update(data.tier_id, {
        tier_name: data.tier_name,
        min_amount: data.min_amount,
        description: data.description,
      });
      return 'Tier updated successfully';
    } catch (error) {
      console.error(error);
      throw new Error('Failed to update tier');
    }
  }
}
