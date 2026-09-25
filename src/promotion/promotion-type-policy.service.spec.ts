import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { PromotionEntity } from './promotion.entity';
import { PromotionService } from './promotion.service';
import { PromotionTypePolicyEntity } from './promotion-type-policy.entity';

type QueryBuilderResult<T> = {
  where: jest.Mock;
  leftJoinAndSelect: jest.Mock;
  setLock: jest.Mock;
  getOne: jest.Mock<Promise<T | null>>;
  getMany: jest.Mock<Promise<T[]>>;
};

const queryBuilder = <T>(result: T | null, many: T[] = []): QueryBuilderResult<T> => {
  const builder: QueryBuilderResult<T> = {
    where: jest.fn(),
    leftJoinAndSelect: jest.fn(),
    setLock: jest.fn(),
    getOne: jest.fn().mockResolvedValue(result),
    getMany: jest.fn().mockResolvedValue(many),
  };
  builder.where.mockReturnValue(builder);
  builder.leftJoinAndSelect.mockReturnValue(builder);
  builder.setLock.mockReturnValue(builder);
  return builder;
};

describe('PromotionService promotion type policy', () => {
  const policy: PromotionTypePolicyEntity = {
    id: 1,
    locked_type: null,
    locked_promo_id: null,
    locked_at: null,
  };
  let policyBuilder: QueryBuilderResult<PromotionTypePolicyEntity>;
  let promotionBuilder: QueryBuilderResult<PromotionEntity>;
  let promotionRepo: jest.Mocked<Pick<Repository<PromotionEntity>, 'find' | 'findOne'>>;
  let manager: {
    getRepository: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: PromotionService;

  const promotion = (
    promo_id: number,
    creditor: PromotionEntity['creditor'] | null,
  ): PromotionEntity =>
    ({ promo_id, promo_name: `Promo ${promo_id}`, creditor, status: true } as PromotionEntity);

  beforeEach(() => {
    policy.locked_type = null;
    policy.locked_promo_id = null;
    policy.locked_at = null;
    policyBuilder = queryBuilder(policy);
    promotionBuilder = queryBuilder(null, []);
    promotionRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    manager = {
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PromotionTypePolicyEntity) {
          return { createQueryBuilder: jest.fn(() => policyBuilder) };
        }
        return { createQueryBuilder: jest.fn(() => promotionBuilder) };
      }),
      create: jest.fn((_entity: unknown, value: object) => value),
      save: jest.fn(async (value: object) => value),
    };
    const dataSource = {
      transaction: jest.fn(async (work: (tx: typeof manager) => Promise<unknown>) => work(manager)),
    } as unknown as DataSource;
    service = new PromotionService(
      promotionRepo as unknown as Repository<PromotionEntity>,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      { findOneBy: jest.fn().mockResolvedValue(policy) } as unknown as Repository<PromotionTypePolicyEntity>,
      dataSource,
    );
  });

  it('rejects a lock when there are no active promotions', async () => {
    promotionBuilder.getMany.mockResolvedValue([]);

    await expect(service.lockPromotionTypePolicy()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a lock when both promotion types are active', async () => {
    promotionBuilder.getMany.mockResolvedValue([
      promotion(1, null),
      promotion(2, { creditor_code: 'CRD001' } as PromotionEntity['creditor']),
    ]);

    await expect(service.lockPromotionTypePolicy()).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('locks one active type even when it has multiple active promotions', async () => {
    const companyPromotions = [
      promotion(7, { creditor_code: 'CRD001' } as PromotionEntity['creditor']),
      promotion(8, { creditor_code: 'CRD001' } as PromotionEntity['creditor']),
    ];
    promotionBuilder.getMany.mockResolvedValue(companyPromotions);
    promotionRepo.find.mockResolvedValue(companyPromotions);

    await expect(service.lockPromotionTypePolicy()).resolves.toEqual({
      locked_type: 'company',
      locked_promo_id: 7,
    });
    await expect(service.getPromotionTypePolicy()).resolves.toMatchObject({
      active_promotion_count: 2,
      active_promotion_counts: { company: 2, wang: 0 },
      eligible_type: 'company',
      eligible_promotion_count: 2,
    });
  });

  it('unlocks the current type without changing promotions', async () => {
    policy.locked_type = 'company';
    policy.locked_promo_id = 7;
    policy.locked_at = new Date();

    await expect(service.unlockPromotionTypePolicy('company')).resolves.toEqual({
      locked_type: null,
      locked_promo_id: null,
    });
    expect(policy).toMatchObject({
      locked_type: null,
      locked_promo_id: null,
      locked_at: null,
    });
    expect(manager.save).toHaveBeenCalledWith(policy);
    expect(promotionBuilder.getMany).not.toHaveBeenCalled();
  });

  it('rejects an unlock from a stale policy state', async () => {
    policy.locked_type = 'company';
    policy.locked_promo_id = 7;

    await expect(service.unlockPromotionTypePolicy('wang')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects opposite-type add, activation, and duplicate while allowing the survivor type', async () => {
    policy.locked_type = 'company';
    policy.locked_promo_id = 7;
    const wangPromotion = promotion(8, null);
    promotionBuilder.getOne.mockResolvedValue(wangPromotion);
    promotionRepo.findOne.mockResolvedValue(wangPromotion);

    await expect(
      service.addPromotion({
        promo_name: 'Wang blocked', creditor_code: null, start_date: new Date(), end_date: new Date(), status: false,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(service.updateStatus(8, true)).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.duplicatePromotion({ promo_id: 8, start_date: new Date(), end_date: new Date() }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.addPromotion({
        promo_name: 'Company allowed', creditor_code: 'CRD001', start_date: new Date(), end_date: new Date(), status: false,
      }),
    ).resolves.toMatchObject({ promo_name: 'Company allowed' });
  });
});
