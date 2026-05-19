import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
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
import { ProductUnitEntity } from 'src/products/product-unit.entity';

// Extended types for transformed product data
export type ProductWithUnits = ProductEntity & {
  pro_unit1?: string;
  pro_unit2?: string;
  pro_unit3?: string;
  pro_ratio1?: number;
  pro_ratio2?: number;
  pro_ratio3?: number;
};

export type PromotionConditionWithTransformedProduct = Omit<
  PromotionConditionEntity,
  'product'
> & {
  product: ProductWithUnits | null;
};

export type PromotionRewardWithTransformedProduct = Omit<
  PromotionRewardEntity,
  'giftProduct'
> & {
  giftProduct: ProductWithUnits | null;
};

export type PromotionTierWithTransformedData = Omit<
  PromotionTierEntity,
  'conditions' | 'rewards'
> & {
  conditions?: PromotionConditionWithTransformedProduct[];
  rewards?: PromotionRewardWithTransformedProduct[];
};

export type PromotionEntityWithTransformedData = Omit<
  PromotionEntity,
  'tiers'
> & {
  tiers?: PromotionTierWithTransformedData[];
};

export type PromotionTierWithTransformedConditions = Omit<
  PromotionTierEntity,
  'conditions'
> & {
  conditions?: PromotionConditionWithTransformedProduct[];
};

export type TierConditionWithTransformedTier = PromotionConditionEntity & {
  tier: PromotionTierWithTransformedData;
};

export type GetAllTiersResult = {
  poster: PromotionTierEntity[];
  reward: PromotionRewardWithTransformedProduct[];
};

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

  private convertEnumToUnitName(
    unitEnum: 1 | 2 | 3 | string,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): string {
    if (!productUnits || productUnits.length === 0) {
      return '';
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.unit_name || String(unitEnum);
  }

  private getRatioFromUnits(
    unitEnum: 1 | 2 | 3 | string,
    productUnits?: { level: number; unit_name: string; ratio: number }[],
  ): number {
    if (!productUnits || productUnits.length === 0) {
      return 1;
    }

    const targetLevel = Number(unitEnum);
    const foundUnit = productUnits.find((unit) => unit.level === targetLevel);

    return foundUnit?.ratio || 1;
  }

  private transformProductData(
    product:
      | {
          units?: { level: number; unit_name: string; ratio: number }[];
          [key: string]: any;
        }
      | null
      | undefined,
  ) {
    if (!product) return product;

    const pro_unit1 = this.convertEnumToUnitName(1, product.units);
    const pro_unit2 = this.convertEnumToUnitName(2, product.units);
    const pro_unit3 = this.convertEnumToUnitName(3, product.units);
    const pro_ratio1 = this.getRatioFromUnits(1, product.units);
    const pro_ratio2 = this.getRatioFromUnits(2, product.units);
    const pro_ratio3 = this.getRatioFromUnits(3, product.units);
    return {
      ...product,
      pro_unit1: isNaN(Number(pro_unit1)) ? pro_unit1 : '',
      pro_unit2: isNaN(Number(pro_unit2)) ? pro_unit2 : '',
      pro_unit3: isNaN(Number(pro_unit3)) ? pro_unit3 : '',
      pro_ratio1,
      pro_ratio2,
      pro_ratio3,
    };
  }

  private transformProductDataUnit(
    product:
      | {
          units?: { level: number; unit_name: string; ratio: number }[];
          [key: string]: any;
        }
      | null
      | undefined,
  ) {
    if (!product) return product;

    const pro_unit1 = this.convertEnumToUnitName(1, product.units);
    const pro_unit2 = this.convertEnumToUnitName(2, product.units);
    const pro_unit3 = this.convertEnumToUnitName(3, product.units);
    return {
      ...product,
      pro_unit1: isNaN(Number(pro_unit1)) ? pro_unit1 : '',
      pro_unit2: isNaN(Number(pro_unit2)) ? pro_unit2 : '',
      pro_unit3: isNaN(Number(pro_unit3)) ? pro_unit3 : '',
    };
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
  }): Promise<PromotionTierWithTransformedConditions | null> {
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
          'promotion.promo_id',
          'promotion.promo_name',

          'condition.cond_id',

          'product.pro_code',
          'product.pro_name',
          'product.pro_priceA',
          'product.pro_priceB',
          'product.pro_priceC',
          'product.pro_imgmain',
          'product.pro_promotion_amount',
          'product.pro_promotion_month',
          'product.pro_stock',
          'product.pro_sale_amount',
          'product.order_quantity',
          'product.pro_lowest_stock',
          'product.viwers',

          'cart.mem_code',
          'cart.spc_amount',
          'cart.spc_unit_enum',
          'cart.is_reward',
        ])
        .getOne();

      if (!tier) return null;

      // Cast tier เป็น type ที่ถูกต้องก่อน modify
      const transformedTier = tier as PromotionTierWithTransformedConditions;

      if (transformedTier.conditions) {
        // Transform product data ก่อน
        const transformedConditions = transformedTier.conditions.map(
          (condition) => ({
            ...condition,
            product: this.transformProductData(condition.product),
          }),
        ) as PromotionConditionWithTransformedProduct[];

        // Sort หลัง transform
        transformedTier.conditions = transformedConditions.sort((a, b) => {
          if (data.sort_by) {
            switch (data.sort_by) {
              case 1:
                return (
                  (b.product?.pro_stock || 0) - (a.product?.pro_stock || 0)
                );
              case 2:
                return (
                  (a.product?.pro_stock || 0) - (b.product?.pro_stock || 0)
                );
              case 3:
                return (
                  (b.product?.pro_priceA || 0) - (a.product?.pro_priceA || 0)
                );
              case 4:
                return (
                  (a.product?.pro_priceA || 0) - (b.product?.pro_priceA || 0)
                );
              case 5:
                return (
                  (b.product?.pro_sale_amount || 0) -
                  (a.product?.pro_sale_amount || 0)
                );
              default:
                return (a.product?.pro_name || '').localeCompare(
                  b.product?.pro_name || '',
                );
            }
          }
          return (a.product?.pro_name || '').localeCompare(
            b.product?.pro_name || '',
          );
        });
      }
      return transformedTier;
    } catch {
      throw new Error(`Failed to get tier products`);
    }
  }

  async getAllTiers(
    mem_code?: string,
    mem_route?: string,
  ): Promise<GetAllTiersResult> {
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
        relations: {
          promotion: true,
        },
        select: {
          tier_id: true,
          tier_name: true,
          tier_postter: true,
          min_amount: true,
          description: true,
          all_products: true,
          promotion: {
            promo_id: true,
            promo_name: true,
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

      const rewardProCodes = reward
        .map((r) => r.giftProduct?.pro_code)
        .filter((c): c is string => !!c);

      const rewardUnits = rewardProCodes.length
        ? await this.productRepo.manager.getRepository(ProductUnitEntity).find({
            where: { pro_code: In(rewardProCodes) },
          })
        : [];

      const rewardUnitsMap: Record<
        string,
        { level: number; unit_name: string; ratio: number }[]
      > = {};
      for (const u of rewardUnits) {
        if (!rewardUnitsMap[u.pro_code]) rewardUnitsMap[u.pro_code] = [];
        rewardUnitsMap[u.pro_code].push({
          level: u.level,
          unit_name: u.unit_name,
          ratio: u.ratio,
        });
      }

      const limitedReward = Object.values(
        reward.reduce(
          (
            acc: Record<number, PromotionRewardWithTransformedProduct[]>,
            item,
          ) => {
            const id = item.tier.tier_id;
            if (!acc[id]) acc[id] = [];
            if (acc[id].length < 3) {
              const productUnits = item.giftProduct?.pro_code
                ? rewardUnitsMap[item.giftProduct.pro_code]
                : undefined;
              acc[id].push({
                ...item,
                unit: this.convertEnumToUnitName(item.unit, productUnits),
                giftProduct: this.transformProductData({
                  ...item.giftProduct,
                  units: productUnits,
                }),
              } as PromotionRewardWithTransformedProduct);
            }
            return acc;
          },
          {} as Record<number, PromotionRewardWithTransformedProduct[]>,
        ),
      ).flat();

      return { poster, reward: limitedReward };
    } catch (error) {
      console.error('Error in getAllTiers:', error);
      throw new Error(`Failed to get tiers: ${error}`);
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
    is_unit_based?: boolean;
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
        is_unit: data.is_unit_based,
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

  async deleteTier(tier_id: number) {
    try {
      return await this.promotionTierRepo.softDelete({ tier_id });
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
      await this.promotionRepo.softDelete({ promo_id });
    } catch {
      throw new Error(`Failed to delete promotion`);
    }
  }

  async createCondition(data: { tier_id: number; product_gcode: string }) {
    try {
      const tireIsUnit = await this.promotionConditionRepo
        .createQueryBuilder('condition')
        .leftJoin('condition.tier', 'tier')
        .leftJoin('condition.product', 'product')
        .where('product.pro_code = :pro_code', {
          pro_code: data.product_gcode,
        })
        .andWhere('tier.is_unit = :is_unit', { is_unit: true })
        .getMany();

      if (tireIsUnit.length > 0)
        throw new NotFoundException(
          'Some promotion tire is unit based, cannot add product condition to this tire',
        );

      const tier = await this.promotionTierRepo.findOne({
        where: { tier_id: data.tier_id },
        relations: ['promotion'],
      });

      const findTierisProduct = await this.promotionTierRepo
        .createQueryBuilder('tier')
        .leftJoin('tier.promotion', 'promotion')
        .where('tier.all_products = true')
        .andWhere('tier.promotion.promo_id = :promo_id', {
          promo_id: tier?.promotion?.promo_id,
        })
        .getMany();

      if (findTierisProduct.length > 0)
        throw new NotFoundException(
          'Cannot set all products for this tier because there are other tiers with the same minimum amount that are not active',
        );

      const newCondition = this.promotionConditionRepo.create({
        tier: { tier_id: data.tier_id },
        product: { pro_code: data.product_gcode },
      } as DeepPartial<PromotionConditionEntity>);
      await this.promotionConditionRepo.save(newCondition);
    } catch (error) {
      console.error(error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : `Failed to create condition`,
      );
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
  ): Promise<PromotionRewardWithTransformedProduct[]> {
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
          'giftProduct.free_product_count',
          'giftProduct.free_product_limit',
        ]);

      if (isL16) {
        query.andWhere(
          '(giftProduct.pro_l16_only = 0 OR giftProduct.pro_l16_only IS NULL)',
        );
      }

      const reward = await query.getMany();

      // 1. collect all pro_code
      const proCodes = reward
        .map((r) => r.giftProduct?.pro_code)
        .filter((c): c is string => !!c);

      // 2. fetch all units for these products
      const allUnits = proCodes.length
        ? await this.productRepo.manager.getRepository(ProductUnitEntity).find({
            where: { pro_code: In(proCodes) },
          })
        : [];

      // 3. group units by pro_code
      const unitsMap: Record<
        string,
        { level: number; unit_name: string; ratio: number }[]
      > = {};
      for (const u of allUnits) {
        // Ensure u is typed correctly (as ProductUnitEntity)
        const pro_code = (u as { pro_code: string }).pro_code;
        const level = (u as { level: number }).level;
        const unit_name = (u as { unit_name: string }).unit_name;
        const ratio = (u as { ratio: number }).ratio;
        if (!pro_code) continue;
        if (!unitsMap[pro_code]) unitsMap[pro_code] = [];
        unitsMap[pro_code].push({ level, unit_name, ratio });
      }

      // 4. map reward.unit (level) to unit_name
      return reward.map((r) => {
        const pro_code = r.giftProduct?.pro_code;
        const productUnits = pro_code ? unitsMap[pro_code] : undefined;
        return {
          ...r,
          unit: this.convertEnumToUnitName(r.unit, productUnits),
          giftProduct: this.transformProductDataUnit({
            ...r.giftProduct,
            units: productUnits,
          }),
        };
      }) as PromotionRewardWithTransformedProduct[];
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
    promotions: PromotionEntityWithTransformedData[];
  }> {
    try {
      console.log('Fetching active promotions with all relations');

      // ดึงข้อมูลพร้อม relations ทั้งหมดในครั้งเดียว
      const promotions = await this.promotionRepo.find({
        relations: {
          tiers: {
            conditions: {
              product: {
                units: true,
              },
            },
            rewards: {
              giftProduct: {
                units: true,
              },
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
              },
            },
          },
        },
      });

      return {
        promotions: promotions.map((promotion) => ({
          ...promotion,
          tiers: promotion.tiers?.map((tier) => ({
            ...tier,
            conditions: tier.conditions?.map((condition) => ({
              ...condition,
              product: this.transformProductData(condition.product),
            })) as PromotionConditionWithTransformedProduct[] | undefined,
            rewards: tier.rewards?.map((reward) => ({
              ...reward,
              giftProduct: this.transformProductData(reward.giftProduct),
            })) as PromotionRewardWithTransformedProduct[] | undefined,
          })) as PromotionTierWithTransformedData[] | undefined,
        })) as PromotionEntityWithTransformedData[],
      };
    } catch (error) {
      console.error('Error fetching promotions:', error);
      throw new Error('Failed to get active promotions');
    }
  }

  async setAllProducts(tier_id: number, status: boolean) {
    try {
      const tier = await this.promotionTierRepo.findOne({
        where: { tier_id },
        relations: ['promotion'],
      });

      const findTierisNotProduct = await this.promotionTierRepo
        .createQueryBuilder('tier')
        .leftJoin('tier.promotion', 'promotion')
        .where('tier.all_products = false')
        .andWhere('tier.promotion.promo_id = :promo_id', {
          promo_id: tier?.promotion?.promo_id,
        })
        .getMany();

      if (findTierisNotProduct.length > 1)
        return 'Cannot set all products for this tier because there are other tiers with the same minimum amount that are not active';

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

  async getTierWithProCode(
    pro_code: string,
    mem_code: string,
  ): Promise<TierConditionWithTransformedTier[]> {
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
          'promotion.promo_id',
          'promotion.promo_name',
          'tier.tier_id',
          'tier.tier_name',
          'tier.min_amount',
          'tier.description',
          'tier.detail',
          'tier.tier_postter',
          'tier.is_unit',

          // เงื่อนไขใน tier
          'tier_conditions.cond_id',

          // ข้อมูล product
          'tier_product.pro_code',
          'tier_product.pro_name',
          'tier_product.pro_priceA',
          'tier_product.pro_priceB',
          'tier_product.pro_priceC',
          'tier_product.pro_imgmain',
          'tier_product.viwers',
          'tier_product.pro_promotion_amount',
          'tier_product.pro_promotion_month',
          'tier_product.pro_stock',
          'tier_product.pro_sale_amount',
          'tier_product.pro_lowest_stock',
          'cart.mem_code',
          'cart.spc_amount',
          'cart.spc_unit_enum',
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
        ])
        .getMany();

      // 1. Collect all product codes from conditions and rewards
      const proCodes = new Set<string>();
      tierCondition.forEach((tc) => {
        tc.tier.conditions?.forEach((cond) => {
          if (cond.product?.pro_code) {
            proCodes.add(cond.product.pro_code);
          }
        });
        tc.tier.rewards?.forEach((reward) => {
          if (reward.giftProduct?.pro_code) {
            proCodes.add(reward.giftProduct.pro_code);
          }
        });
      });

      const proCodesArray = Array.from(proCodes);

      // 2. Fetch all units for these products
      const allUnits = proCodesArray.length
        ? await this.productRepo.manager.getRepository(ProductUnitEntity).find({
            where: { pro_code: In(proCodesArray) },
          })
        : [];

      // 3. Group units by pro_code
      const unitsMap: Record<string, ProductUnitEntity[]> = {};
      for (const u of allUnits) {
        if (!unitsMap[u.pro_code]) unitsMap[u.pro_code] = [];
        unitsMap[u.pro_code].push(u);
      }

      // 4. Map and transform
      return tierCondition.map((tc) => ({
        ...tc,
        tier: {
          ...tc.tier,
          conditions: tc.tier.conditions?.map((condition) => ({
            ...condition.product,
            ...condition,
            units: condition.product
              ? unitsMap[condition.product.pro_code]
              : [],
          })) as PromotionConditionWithTransformedProduct[] | undefined,
          rewards: tc.tier.rewards?.map((reward) => {
            const rewardUnits = reward.giftProduct
              ? unitsMap[reward.giftProduct.pro_code] || []
              : [];
            const foundUnit = rewardUnits.find(
              (u) =>
                u.unit_name === reward.unit ||
                String(u.level) === String(reward.unit),
            );
            return {
              ...reward,
              unit: foundUnit?.unit_name || reward.unit,
              giftProduct: this.transformProductDataUnit({
                ...reward.giftProduct,
                units: rewardUnits,
              }),
            };
          }) as PromotionRewardWithTransformedProduct[] | undefined,
        },
      })) as TierConditionWithTransformedTier[];
    } catch (error) {
      console.error('Error in getTierWithProCode:', error);
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
        relations: {
          promotion: true,
        },
        select: {
          tier_id: true,
          tier_name: true,
          tier_postter: true,
          min_amount: true,
          description: true,
          all_products: true,
          promotion: {
            promo_id: true,
            promo_name: true,
          },
        },
      });
    } catch {
      throw new Error(`Failed to get tier with all products`);
    }
  }

  async getRewardByTierId(
    tier_id: number,
    mem_code?: string,
    mem_route?: string,
  ): Promise<PromotionRewardWithTransformedProduct[]> {
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

      const result = await rewardQuery.getMany();

      const proCodes = result
        .map((r) => r.giftProduct?.pro_code)
        .filter((c): c is string => !!c);

      const allUnits = proCodes.length
        ? await this.productRepo.manager
            .getRepository(ProductUnitEntity)
            .find({ where: { pro_code: In(proCodes) } })
        : [];

      const unitsMap: Record<
        string,
        { level: number; unit_name: string; ratio: number }[]
      > = {};
      for (const u of allUnits) {
        if (!unitsMap[u.pro_code]) unitsMap[u.pro_code] = [];
        unitsMap[u.pro_code].push({
          level: u.level,
          unit_name: u.unit_name,
          ratio: u.ratio,
        });
      }

      return result.map((r) => {
        const productUnits = r.giftProduct?.pro_code
          ? unitsMap[r.giftProduct.pro_code]
          : undefined;
        return {
          ...r,
          unit: this.convertEnumToUnitName(r.unit, productUnits),
          giftProduct: this.transformProductDataUnit({
            ...r.giftProduct,
            units: productUnits,
          }),
        };
      }) as PromotionRewardWithTransformedProduct[];
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

  async updateTierPoster(tier_id: number, file: Express.Multer.File) {
    try {
      const tier = await this.promotionTierRepo.findOne({
        where: { tier_id },
      });

      if (!tier) {
        throw new Error(`Tier with id ${tier_id} not found`);
      }

      if (!file) {
        throw new Error('No file provided for updating tier poster');
      }

      if (tier.tier_postter) {
        const deleteParams = {
          Bucket: 'wang-storage',
          Key: tier.tier_postter.split('/').slice(-1)[0],
        };
        await this.s3.deleteObject(deleteParams).promise();
      }

      const uploadParams = {
        Bucket: 'wang-storage',
        Key: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      };

      const imgData = await this.s3.upload(uploadParams).promise();

      await this.promotionTierRepo.update(tier_id, {
        tier_postter: imgData.Location,
      });

      return {
        message: 'Tier poster updated successfully',
        url: imgData.Location,
      };
    } catch (error) {
      console.error('Error updating tier poster:', error);
      throw new Error(`Failed to update tier poster`);
    }
  }

  async getTierPrice(promotion_id: number, tier_id: number) {
    try {
      const data = await this.promotionRepo.findOne({
        withDeleted: true,
        where: {
          promo_id: promotion_id,
          tiers: {
            tier_id: tier_id,
          },
        },
        relations: {
          tiers: true,
        },
        select: {
          tiers: {
            tier_id: true,
            min_amount: true,
          },
        },
      });

      const minAmount = data?.tiers.find(
        (t) => t.tier_id === tier_id,
      )?.min_amount;

      console.log('data : ', data);

      console.log(
        `Min amount for promotion ${promotion_id} and tier ${tier_id}:`,
        minAmount,
      );

      return { minAmount: minAmount };
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to get tier price`);
    }
  }

  async findPromotionTypeUnitBased(pro_code: string) {
    const findCondition = await this.promotionConditionRepo
      .createQueryBuilder('condition')
      .leftJoin('condition.product', 'product')
      .leftJoin('condition.tier', 'tier')
      .where('product.pro_code = :pro_code', { pro_code })
      .andWhere('tier.is_unit = :is_unit', { is_unit: true })
      .select('product.pro_code')
      .getMany();

    if (findCondition) {
      return findCondition;
    } else {
      return;
    }
  }
}
