import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PromotionService } from './promotion.service';
import { PromotionEntity } from './promotion.entity';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import { PromotionTypePolicyEntity } from './promotion-type-policy.entity';
import { ProductEntity } from 'src/products/products.entity';
import { findBuyGiftConflicts } from './buy-gift-conflict.util';

type Usage = { pro_code: string; tier_id: number | string; tier_name: string };

describe('findBuyGiftConflicts', () => {
  it('finds a product used as buy in one tier and gift in another', () => {
    expect(
      findBuyGiftConflicts(
        [{ pro_code: 'A', tier_name: 'Tier 1' }],
        [
          { pro_code: 'A', tier_name: 'Tier 2' },
          { pro_code: 'B', tier_name: 'Tier 2' },
        ],
      ),
    ).toEqual([
      { pro_code: 'A', condition_tier: 'Tier 1', reward_tier: 'Tier 2' },
    ]);
  });

  it('returns [] when buy and gift products never overlap', () => {
    expect(
      findBuyGiftConflicts(
        [{ pro_code: 'A', tier_name: 'Tier 1' }],
        [{ pro_code: 'B', tier_name: 'Tier 1' }],
      ),
    ).toEqual([]);
  });
});

describe('PromotionService buy/gift rule (ทุก tier ในโปรเดียวกัน)', () => {
  const promotion = {
    promo_id: 1,
    start_date: new Date(),
    end_date: new Date(),
  };
  let service: PromotionService;
  let tierRepo: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let conditionRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let rewardRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let promotionRepo: { findOne: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let overlap: { assertPromotionPairAvailable: jest.Mock };
  let usage: jest.SpyInstance;

  const mockUsage = (conditions: Usage[], rewards: Usage[]) =>
    usage.mockResolvedValue({ conditions, rewards });

  beforeEach(() => {
    tierRepo = {
      findOne: jest.fn().mockResolvedValue({
        tier_id: 10,
        tier_name: 'Tier 1',
        is_unit: false,
        promotion,
      }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {
          getMany: jest.fn().mockResolvedValue([]),
        };
        for (const fn of ['leftJoin', 'where', 'andWhere']) {
          qb[fn] = jest.fn().mockReturnValue(qb);
        }
        return qb;
      }),
    };
    conditionRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v: object) => v),
      save: jest.fn().mockResolvedValue(undefined),
    };
    rewardRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v: object) => v),
      save: jest.fn().mockResolvedValue(undefined),
    };
    promotionRepo = { findOne: jest.fn() };
    dataSource = { transaction: jest.fn() };
    overlap = {
      assertPromotionPairAvailable: jest.fn().mockResolvedValue(undefined),
    };
    const productRepo = {
      manager: {
        getRepository: jest.fn(() => ({
          findOne: jest.fn().mockResolvedValue(null),
        })),
      },
    };

    service = new PromotionService(
      promotionRepo as unknown as Repository<PromotionEntity>,
      {} as never,
      {} as never,
      tierRepo as unknown as Repository<PromotionTierEntity>,
      conditionRepo as unknown as Repository<PromotionConditionEntity>,
      rewardRepo as unknown as Repository<PromotionRewardEntity>,
      {} as never,
      {} as never,
      {} as never,
      productRepo as unknown as Repository<ProductEntity>,
      {} as never,
      {} as unknown as Repository<PromotionTypePolicyEntity>,
      dataSource as unknown as DataSource,
      overlap as never,
    );
    usage = jest.spyOn(
      service as unknown as {
        getPromotionProductUsage: () => Promise<unknown>;
      },
      'getPromotionProductUsage',
    );
  });

  it('createCondition rejects a product that is a gift in another tier', async () => {
    mockUsage([], [{ pro_code: 'A', tier_id: 11, tier_name: 'Tier 2' }]);
    await expect(
      service.createCondition({ tier_id: 10, product_gcode: 'A' }),
    ).rejects.toThrow(
      new BadRequestException(
        'สินค้า A เป็นของแถมใน Tier 2 ของโปรนี้อยู่แล้ว ไม่สามารถเลือกเป็นสินค้าเข้าร่วมรายการได้',
      ),
    );
    expect(conditionRepo.save).not.toHaveBeenCalled();
  });

  it('createCondition allows a product that is only a buy product elsewhere', async () => {
    mockUsage(
      [{ pro_code: 'A', tier_id: 11, tier_name: 'Tier 2' }],
      [{ pro_code: 'B', tier_id: 10, tier_name: 'Tier 1' }],
    );
    await expect(
      service.createCondition({ tier_id: 10, product_gcode: 'A' }),
    ).resolves.toBeUndefined();
    expect(conditionRepo.save).toHaveBeenCalled();
  });

  it('createReward rejects a product that is a buy product in another tier', async () => {
    mockUsage([{ pro_code: 'A', tier_id: 10, tier_name: 'Tier 1' }], []);
    await expect(
      service.createReward({
        tier_id: 11,
        product_gcode: 'A',
        qty: 1,
        unit: 'ชิ้น',
      }),
    ).rejects.toThrow(
      'สินค้า A เป็นสินค้าเข้าร่วมรายการใน Tier 1 ของโปรนี้อยู่แล้ว',
    );
    expect(rewardRepo.save).not.toHaveBeenCalled();
  });

  it('createReward allows a product that is not a buy product anywhere in the promotion', async () => {
    mockUsage([{ pro_code: 'A', tier_id: 10, tier_name: 'Tier 1' }], []);
    await expect(
      service.createReward({
        tier_id: 11,
        product_gcode: 'B',
        qty: 1,
        unit: 'ชิ้น',
      }),
    ).resolves.toBeUndefined();
    expect(rewardRepo.save).toHaveBeenCalled();
  });

  it('getTierOneById returns usage of other tiers only (raw tier_id may come back as string)', async () => {
    mockUsage(
      [
        { pro_code: 'A', tier_id: '10', tier_name: 'Tier 1' },
        { pro_code: 'C', tier_id: '11', tier_name: 'Tier 2' },
      ],
      [{ pro_code: 'B', tier_id: '11', tier_name: 'Tier 2' }],
    );
    const result = await service.getTierOneById(10);
    expect(result?.other_tier_usage).toEqual({
      conditions: [{ pro_code: 'C', tier_id: '11', tier_name: 'Tier 2' }],
      rewards: [{ pro_code: 'B', tier_id: '11', tier_name: 'Tier 2' }],
    });
    expect(result).not.toHaveProperty('promotion');
  });

  it('duplicatePromotion refuses to copy a source that breaks the rule', async () => {
    promotionRepo.findOne.mockResolvedValue({
      ...promotion,
      promo_name: 'Old promo',
      creditor: null,
      creditors: [],
      tiers: [
        {
          tier_name: 'Tier 1',
          conditions: [{ product: { pro_code: 'A' } }],
          rewards: [],
        },
        {
          tier_name: 'Tier 2',
          conditions: [],
          rewards: [{ giftProduct: { pro_code: 'A' } }],
        },
      ],
    });
    await expect(
      service.duplicatePromotion({
        promo_id: 1,
        start_date: new Date(),
        end_date: new Date(),
      }),
    ).rejects.toThrow('A (สินค้าเข้าร่วมรายการใน Tier 1 / ของแถมใน Tier 2)');
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
