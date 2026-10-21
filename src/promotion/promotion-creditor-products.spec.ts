import { BadRequestException } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { PromotionService } from './promotion.service';
import { PromotionEntity } from './promotion.entity';
import { PromotionTierEntity } from './promotion-tier.entity';
import { PromotionConditionEntity } from './promotion-condition.entity';
import { PromotionRewardEntity } from './promotion-reward.entity';
import { PromotionTypePolicyEntity } from './promotion-type-policy.entity';

describe('PromotionService.setCreditorProductsCondition (สินค้าทั้งหมดของเจ้าหนี้)', () => {
  const promotion = {
    promo_id: 1,
    start_date: new Date(),
    end_date: new Date(),
    creditor: { creditor_code: 'C1' },
    creditors: [{ creditor_code: 'C1' }, { creditor_code: 'C2' }],
  };
  let service: PromotionService;
  let tierRepo: { findOne: jest.Mock; count: jest.Mock };
  let conditionRepo: {
    find: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };
  let rewardRepo: { find: jest.Mock };
  let overlap: { findPromotionPairConflicts: jest.Mock };
  let products: { getProductByCreditor: jest.Mock };
  let usage: jest.SpyInstance;

  beforeEach(() => {
    tierRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ tier_id: 10, is_unit: false, promotion }),
      count: jest.fn().mockResolvedValue(0),
    };
    conditionRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((v: object) => v),
      save: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    rewardRepo = {
      find: jest
        .fn()
        .mockResolvedValue([{ reward_id: 1, giftProduct: { pro_code: 'G' } }]),
    };
    overlap = { findPromotionPairConflicts: jest.fn().mockResolvedValue([]) };
    products = {
      getProductByCreditor: jest
        .fn()
        .mockResolvedValue([
          { pro_code: 'A' },
          { pro_code: 'B' },
          { pro_code: 'C' },
          { pro_code: 'D' },
        ]),
    };

    service = new PromotionService(
      {} as unknown as Repository<PromotionEntity>,
      {} as never,
      {} as never,
      tierRepo as unknown as Repository<PromotionTierEntity>,
      conditionRepo as unknown as Repository<PromotionConditionEntity>,
      rewardRepo as unknown as Repository<PromotionRewardEntity>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as unknown as Repository<PromotionTypePolicyEntity>,
      {} as unknown as DataSource,
      overlap as never,
      products as never,
    );
    usage = jest
      .spyOn(
        service as unknown as {
          getPromotionProductUsage: () => Promise<unknown>;
        },
        'getPromotionProductUsage',
      )
      .mockResolvedValue({ conditions: [], rewards: [] });
  });

  it('adds only creditor products not yet selected, skipping gifts and overlapping pairs', async () => {
    conditionRepo.find.mockResolvedValue([
      { cond_id: 5, product: { pro_code: 'A' } },
    ]);
    usage.mockResolvedValue({
      conditions: [],
      rewards: [{ pro_code: 'B', tier_id: 11, tier_name: 'Tier 2' }],
    });
    overlap.findPromotionPairConflicts.mockResolvedValue([
      { source: 'Hotdeal ID 9', buyCode: 'C', giftCode: 'G' },
    ]);

    const result = await service.setCreditorProductsCondition(10, true);

    expect(products.getProductByCreditor).toHaveBeenCalledWith(['C1', 'C2']);
    expect(overlap.findPromotionPairConflicts).toHaveBeenCalledWith(
      expect.objectContaining({ buyCodes: ['C', 'D'], giftCodes: ['G'] }),
    );
    expect(conditionRepo.save).toHaveBeenCalledWith(
      [{ tier: { tier_id: 10 }, product: { pro_code: 'D' } }],
      { chunk: 200 },
    );
    expect(result).toEqual({
      added: 1,
      removed: 0,
      skipped: [
        { pro_code: 'B', reason: 'เป็นของแถมใน Tier 2' },
        {
          pro_code: 'C',
          reason: 'ซื้อ C แถม G ซ้ำกับ Hotdeal ID 9',
        },
      ],
    });
  });

  it('removes only conditions that belong to the creditor products', async () => {
    conditionRepo.find.mockResolvedValue([
      { cond_id: 5, product: { pro_code: 'A' } },
      { cond_id: 6, product: { pro_code: 'X' } },
    ]);

    const result = await service.setCreditorProductsCondition(10, false);

    expect(conditionRepo.delete).toHaveBeenCalledWith({ cond_id: In([5]) });
    expect(result).toEqual({ added: 0, removed: 1, skipped: [] });
  });

  it('rejects adding to a unit-based tier', async () => {
    tierRepo.findOne.mockResolvedValue({
      tier_id: 10,
      is_unit: true,
      promotion,
    });
    await expect(
      service.setCreditorProductsCondition(10, true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(conditionRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a promotion without creditors', async () => {
    tierRepo.findOne.mockResolvedValue({
      tier_id: 10,
      is_unit: false,
      promotion: { ...promotion, creditor: null, creditors: [] },
    });
    await expect(
      service.setCreditorProductsCondition(10, true),
    ).rejects.toThrow(new BadRequestException('โปรนี้ไม่มีเจ้าหนี้'));
  });
});
