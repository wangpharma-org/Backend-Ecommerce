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
  In,
} from 'typeorm';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import * as AWS from 'aws-sdk';
import { Cron } from '@nestjs/schedule';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { CodePromotionEntity } from './code-promotion.entity';
import { AuthService } from 'src/auth/auth.service';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';

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
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {
    this.s3 = new AWS.S3({
      endpoint: new AWS.Endpoint('https://sgp1.digitaloceanspaces.com'),
      accessKeyId: process.env.DO_SPACES_KEY,
      secretAccessKey: process.env.DO_SPACES_SECRET,
    });
  }

  private async isL16Member(
    mem_code?: string,
    mem_route?: string,
  ): Promise<boolean> {
    if (mem_route !== undefined && mem_route !== null) {
      return mem_route.toUpperCase() === 'L16';
    }
    if (!mem_code) {
      return false;
    }
    const member = await this.userRepo.findOne({
      where: { mem_code },
      select: ['mem_route'],
    });
    return member?.mem_route?.toUpperCase() === 'L16';
  }

  @Cron('0 0 * * *', { timeZone: 'Asia/Bangkok' })
  // @Cron(CronExpression.EVERY_30_SECONDS)
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
      await this.shoppingCartService.markCartAsChanged(mem_code);
    } catch (error) {
      console.error(error);
      throw new Error('Failed to check reward in cart');
    }
  }

  async tierProducts(data: {
    tier_id: number;
    mem_code: string;
    sort_by?: number;
  }) {
    try {
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const tier = await this.promotionTierRepo
        .createQueryBuilder('tier')
        .leftJoinAndSelect('tier.promotion', 'promotion')
        .leftJoinAndSelect('tier.conditions', 'condition')
        .leftJoinAndSelect('condition.product', 'product')
        .leftJoinAndSelect(
          'product.inCarts',
          'cart',
          'cart.mem_code = :mem_code AND cart.is_reward = false',
          { mem_code: data.mem_code },
        )
        .where('tier.tier_id = :tier_id', { tier_id: data.tier_id })
        .andWhere('promotion.status = true')
        .andWhere('promotion.start_date <= :endOfDay', { endOfDay })
        .andWhere('promotion.end_date >= :startOfDay', { startOfDay })
        .select([
          'tier.tier_id',
          'tier.tier_name',
          'tier.min_amount',
          'tier.description',
          'tier.tier_postter',
          'tier.detail',

          'condition.cond_id',

          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_unit1',
          'product.pro_unit2',
          'product.pro_unit3',
          'product.pro_promotion_amount',
          'product.pro_promotion_month',
          'product.pro_stock',
          'product.pro_sale_amount',
          'product.order_quantity',
          'product.pro_lowest_stock',
          'product.viwers',

          'cart.mem_code',
          'cart.spc_amount',
          'cart.spc_unit',
          'cart.is_reward',
        ])
        .getOne();

      if (!tier) return null;

      if (tier.conditions) {
        tier.conditions = tier.conditions.sort((a, b) => {
          if (data.sort_by) {
            switch (data.sort_by) {
              case 1:
                return b.product.pro_stock - a.product.pro_stock;
              case 2:
                return a.product.pro_stock - b.product.pro_stock;
              case 3:
                return b.product.pro_priceA - a.product.pro_priceA;
              case 4:
                return a.product.pro_priceA - b.product.pro_priceA;
              case 5:
                return b.product.pro_sale_amount - a.product.pro_sale_amount;
              default:
                return a.product.pro_name.localeCompare(b.product.pro_name);
            }
          }
          return a.product.pro_name.localeCompare(b.product.pro_name);
        });
      }
      return tier;
    } catch {
      throw new Error(`Failed to get tier products`);
    }
  }

  async getAllTiers(
    mem_code?: string,
    mem_route?: string,
  ) {
    try {
      const Today = new Date();
      const startOfDay = new Date(Today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(Today.setHours(23, 59, 59, 999));
      const isL16 = await this.isL16Member(mem_code, mem_route);
      
      const poster = await this.promotionTierRepo.find({
        where: {
          promotion: {
            status: true,
            start_date: LessThanOrEqual(startOfDay),
            end_date: MoreThanOrEqual(endOfDay),
          },
        },
      });
      
      if (!poster.length) {
        console.log('No active promotions found');
        return { poster: [], reward: [] };
      }

      const tierIds = poster
        .map((p) => p.tier_id)
        .filter((id): id is number => id !== undefined && id !== null);
      if (!tierIds.length) {
        console.log('No tier IDs found for active promotions');
        return { poster, reward: [] };
      }
      
      const rewardQuery = this.promotionRewardRepo
        .createQueryBuilder('reward')
        .leftJoinAndSelect('reward.tier', 'tier')
        .leftJoinAndSelect('reward.giftProduct', 'giftProduct')
        .where('tier.tier_id IN (:...tierIds)', {
          tierIds,
        })
        .select([
          'reward',
          'tier.tier_id',
          'giftProduct.pro_code',
          'giftProduct.pro_name', 
          'giftProduct.pro_imgmain',
        ]);
      
      if (isL16) {
        rewardQuery.andWhere(
          '(giftProduct.pro_l16_only = 0 OR giftProduct.pro_l16_only IS NULL)',
        );
      }
      
      const reward = await rewardQuery.getMany();

      const limitedReward = Object.values(
        reward.reduce(
          (acc: Record<number, typeof reward>, item) => {
            const id = item.tier.tier_id;
            if (!acc[id]) acc[id] = [];
            if (acc[id].length < 3) acc[id].push(item);
            return acc;
          },
          {} as Record<number, typeof reward>,
        ),
      ).flat();

      return { poster, reward: limitedReward };
    } catch (error) {
      console.error('Error in getAllTiers:', error);
      throw new Error(`Failed to get tiers: ${error.message}`);
    }
  }

  async getAllTiersProduct(): Promise<string[]> {
    try {
      const Today = new Date();
      const startOfDay = new Date(Today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(Today.setHours(23, 59, 59, 999));
      const tiers = await this.promotionTierRepo.find({
        where: {
          promotion: {
            status: true,
            start_date: LessThanOrEqual(startOfDay),
            end_date: MoreThanOrEqual(endOfDay),
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
    creditor_code: string | null;
    start_date: Date;
    end_date: Date;
    status: boolean;
  }) {
    try {
      // console.log(data);
      const newPromotion = this.promotionRepo.create({
        promo_name: data.promo_name,
        creditor: data.creditor_code
          ? { creditor_code: data.creditor_code }
          : undefined,
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
    detail?: string;
    file: Express.Multer.File;
  }) {
    // console.log(data);
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
        detail: data.detail,
      });
      await this.promotionTierRepo.save(newTier);
    } catch {
      // console.log(error);
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

  async getRewardsByTier(
    tier_id: number,
    mem_code?: string,
    mem_route?: string,
  ) {
    try {
      const isL16 = await this.isL16Member(mem_code, mem_route);
      
      const query = this.promotionRewardRepo
        .createQueryBuilder('reward')
        .leftJoinAndSelect('reward.giftProduct', 'giftProduct')
        .where('reward.tier_id = :tier_id', { tier_id })
        .select([
          'reward.reward_id',
          'reward.qty',
          'reward.unit',
          'giftProduct.pro_code',
          'giftProduct.pro_name',
          'giftProduct.pro_genericname',
          'giftProduct.pro_imgmain',
          'giftProduct.pro_unit1',
          'giftProduct.pro_unit2',
          'giftProduct.pro_unit3',
          'giftProduct.free_product_count',
          'giftProduct.free_product_limit',
        ]);
      
      if (isL16) {
        query.andWhere(
          '(giftProduct.pro_l16_only = 0 OR giftProduct.pro_l16_only IS NULL)',
        );
      }
      
      return await query.getMany();
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
            pro_name: true,
            pro_genericname: true,
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
        detail: data.description,
      });
      return 'Tier updated successfully';
    } catch (error) {
      console.error(error);
      throw new Error('Failed to update tier');
    }
  }

  async getPromotions(): Promise<{
    promotions: PromotionEntity[];
  }> {
    try {
      console.log('Fetching active promotions with all relations');

      // ดึงข้อมูลพร้อม relations ทั้งหมดในครั้งเดียว
      const promotions = await this.promotionRepo.find({
        relations: {
          tiers: {
            conditions: {
              product: true,
            },
            rewards: {
              giftProduct: true,
            },
          },
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
          tiers: {
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
                pro_genericname: true,
                pro_priceA: true,
                pro_priceB: true,
                pro_priceC: true,
                pro_imgmain: true,
                pro_unit1: true,
                pro_unit2: true,
                pro_unit3: true,
              },
            },
            rewards: {
              reward_id: true,
              qty: true,
              unit: true,
              giftProduct: {
                pro_code: true,
                pro_name: true,
                pro_genericname: true,
                pro_imgmain: true,
                pro_unit1: true,
                pro_unit2: true,
                pro_unit3: true,
              },
            },
          },
        },
      });

      return {
        promotions,
      };
    } catch (error) {
      console.error('Error fetching promotions:', error);
      throw new Error('Failed to get active promotions');
    }
  }

  async setAllProducts(tier_id: number, status: boolean) {
    try {
      if (status === true) {
        await this.promotionConditionRepo.delete({ tier: { tier_id } });
        await this.promotionTierRepo.update(tier_id, {
          all_products: true,
        });
        return 'All products set successfully for the tier';
      } else {
        await this.promotionTierRepo.update(tier_id, {
          all_products: false,
        });
        return 'Tier set to specific products successfully';
      }
    } catch (error) {
      console.error(error);
      throw new Error('Failed to set all products for the tier');
    }
  }

  async getTierWithProCode(pro_code: string, mem_code: string) {
    try {
      const Today = new Date();
      const startOfDay = new Date(Today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(Today.setHours(23, 59, 59, 999));
      const tierCondition = await this.promotionConditionRepo
        .createQueryBuilder('condition')
        .leftJoinAndSelect('condition.product', 'product')
        .leftJoinAndSelect('condition.tier', 'tier')
        .leftJoinAndSelect('tier.promotion', 'promotion')
        .leftJoinAndSelect('tier.conditions', 'tier_conditions')
        .leftJoinAndSelect('tier_conditions.product', 'tier_product')
        .leftJoinAndSelect(
          'tier_product.inCarts',
          'cart',
          'cart.mem_code = :mem_code AND cart.is_reward = false',
        )
        .setParameter('mem_code', mem_code)
        .leftJoinAndSelect('tier.rewards', 'rewards')
        .leftJoinAndSelect('rewards.giftProduct', 'gift_product')
        .leftJoinAndSelect('product.flashsale', 'product_flashsale')
        .leftJoinAndSelect('product_flashsale.flashsale', 'flashsale')
        .where('product.pro_code = :pro_code', { pro_code })
        .andWhere('promotion.status = true')
        .andWhere('promotion.start_date <= :endOfDay', { endOfDay })
        .andWhere('promotion.end_date >= :startOfDay', { startOfDay })
        .select([
          'condition.cond_id',
          'tier.tier_id',
          'tier.tier_name',
          'tier.min_amount',
          'tier.description',
          'tier.tier_postter',

          // เงื่อนไขใน tier
          'tier_conditions.cond_id',

          // ข้อมูล product
          'tier_product.pro_code',
          'tier_product.pro_name',
          'tier_product.pro_priceA',
          'tier_product.pro_priceB',
          'tier_product.pro_priceC',
          'tier_product.pro_imgmain',
          'tier_product.pro_unit1',
          'tier_product.pro_unit2',
          'tier_product.pro_unit3',
          'tier_product.viwers',
          'tier_product.pro_promotion_amount',
          'tier_product.pro_promotion_month',
          'tier_product.pro_stock',
          'tier_product.pro_sale_amount',
          'tier_product.pro_lowest_stock',
          'cart.mem_code',
          'cart.spc_amount',
          'cart.spc_unit',
          'product_flashsale.id',
          'product_flashsale.limit',
          'flashsale.promotion_id',
          'flashsale.date',
          'flashsale.time_start',
          'flashsale.time_end',
          // ของรางวัล
          'rewards.reward_id',
          'rewards.qty',
          'rewards.unit',
          'gift_product.pro_code',
          'gift_product.pro_name',
          'gift_product.pro_imgmain',
          'gift_product.pro_unit1',
          'gift_product.pro_unit2',
          'gift_product.pro_unit3',
        ])
        .getMany();
      return tierCondition;
    } catch {
      throw new Error('Failed to get tier with product code');
    }
  }

  async getTierAllProduct() {
    try {
      const Today = new Date();
      const startOfDay = new Date(Today.setHours(0, 0, 0, 0));
      const endOfDay = new Date(Today.setHours(23, 59, 59, 999));
      return await this.promotionTierRepo.find({
        where: {
          all_products: true,
          promotion: {
            status: true,
            start_date: LessThanOrEqual(startOfDay),
            end_date: MoreThanOrEqual(endOfDay),
          },
        },
      });
    } catch {
      throw new Error(`Failed to get tier with all products`);
    }
  }

  async getRewardByTierId(tier_id: number, mem_code?: string, mem_route?: string) {
    try {
      const isL16 = await this.isL16Member(mem_code, mem_route);
      
      const rewardQuery = this.promotionRewardRepo
        .createQueryBuilder('reward')
        .leftJoinAndSelect('reward.giftProduct', 'giftProduct')
        .where('reward.tier.tier_id = :tier_id', { tier_id })
        .select([
          'reward.reward_id',
          'reward.qty',
          'reward.unit',
          'giftProduct.pro_code',
          'giftProduct.pro_name',
          'giftProduct.pro_genericname',
          'giftProduct.pro_imgmain',
        ]);
      
      if (isL16) {
        rewardQuery.andWhere(
          '(giftProduct.pro_l16_only = 0 OR giftProduct.pro_l16_only IS NULL)',
        );
      }
      
      return await rewardQuery.getMany();
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to get reward by tier id`);
    }
  }

  async rewardUpdateLimit(pro_code: string, limit: number) {
    try {
      await this.productRepo.update(
        { pro_code: pro_code },
        {
          free_product_limit: limit,
        },
      );
    } catch {
      throw new Error(`Failed to update reward limit`);
    }
  }

  async resetCountLimit(pro_code: string) {
    try {
      await this.productRepo.update(
        { pro_code: pro_code },
        {
          free_product_count: 0,
        },
      );
    } catch {
      throw new Error(`Failed to update reward limit`);
    }
  }
}
