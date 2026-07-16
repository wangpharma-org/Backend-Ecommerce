import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DeliveryPreferenceService } from './delivery-preference.service';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { UserEntity } from '../users/users.entity';
import { CustomerDeliveryPreferenceEntity } from './customer-delivery-preference.entity';
import { DELIVERY_PREFERENCE_OPTIONS } from './delivery-preference.constants';

describe('DeliveryPreferenceService', () => {
  let service: DeliveryPreferenceService;
  let featureFlagsService: { getFlag: jest.Mock };
  let userRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    count: jest.Mock;
  };
  let userQueryBuilder: {
    select: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let cacheRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    upsert: jest.Mock;
  };
  let cacheQueryBuilder: {
    innerJoin: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    where: jest.Mock;
    groupBy: jest.Mock;
    getRawMany: jest.Mock;
  };

  beforeEach(async () => {
    featureFlagsService = { getFlag: jest.fn() };
    userQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(userQueryBuilder),
      findOne: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(0),
    };
    cacheQueryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    cacheRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(cacheQueryBuilder),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DeliveryPreferenceService,
        { provide: FeatureFlagsService, useValue: featureFlagsService },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        {
          provide: getRepositoryToken(CustomerDeliveryPreferenceEntity),
          useValue: cacheRepo,
        },
      ],
    }).compile();

    service = module.get<DeliveryPreferenceService>(DeliveryPreferenceService);
  });

  describe('getCheckoutOptions', () => {
    it('is disabled when the feature flag is off', async () => {
      featureFlagsService.getFlag.mockResolvedValue(false);
      const result = await service.getCheckoutOptions('mem-001', 'L1-1');
      expect(result).toEqual({
        enabled: false,
        options: [],
        currentPreference: null,
      });
      expect(cacheRepo.findOne).not.toHaveBeenCalled();
    });

    it('is disabled when mem_route is not in the enabled routes', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      const result = await service.getCheckoutOptions('mem-001', 'L16');
      expect(result).toEqual({
        enabled: false,
        options: [],
        currentPreference: null,
      });
    });

    it('is enabled for an eligible route when the flag is on', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      const result = await service.getCheckoutOptions('mem-001', 'L23');
      expect(result.enabled).toBe(true);
      expect(result.options).toEqual([...DELIVERY_PREFERENCE_OPTIONS]);
    });

    it('returns the cached preference when present', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      cacheRepo.findOne.mockResolvedValue({
        mem_code: 'mem-001',
        preference: 'van_only',
      });
      const result = await service.getCheckoutOptions('mem-001', 'L23');
      expect(result.currentPreference).toBe('van_only');
    });
  });

  describe('setCustomerPreference', () => {
    it('rejects when the feature flag is off', async () => {
      featureFlagsService.getFlag.mockResolvedValue(false);
      const result = await service.setCustomerPreference(
        'mem-001',
        'L1-1',
        'van_only',
      );
      expect(result).toEqual({ ok: false, reason: 'not_eligible' });
      expect(cacheRepo.upsert).not.toHaveBeenCalled();
    });

    it('rejects when mem_route is not eligible', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      const result = await service.setCustomerPreference(
        'mem-001',
        'L16',
        'van_only',
      );
      expect(result).toEqual({ ok: false, reason: 'not_eligible' });
    });

    it('rejects an unknown preference key', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      const result = await service.setCustomerPreference(
        'mem-001',
        'L1-1',
        'not_a_real_key',
      );
      expect(result).toEqual({ ok: false, reason: 'invalid_key' });
    });

    it('saves and returns ok when eligible and the key is valid', async () => {
      featureFlagsService.getFlag.mockResolvedValue(true);
      const result = await service.setCustomerPreference(
        'mem-001',
        'L23',
        'delivery_always',
      );
      expect(result).toEqual({ ok: true });
      expect(cacheRepo.upsert).toHaveBeenCalledWith(
        { mem_code: 'mem-001', preference: 'delivery_always' },
        ['mem_code'],
      );
    });
  });

  describe('listEligibleCustomers', () => {
    it('lists eligible-route customers without requiring a keyword', async () => {
      userQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ mem_code: 'mem-001', mem_nameSite: 'ร้านทดสอบ', mem_route: 'L1-1' }],
        1,
      ]);
      const result = await service.listEligibleCustomers();
      expect(userQueryBuilder.andWhere).not.toHaveBeenCalled();
      expect(result.items).toEqual([
        {
          mem_code: 'mem-001',
          mem_nameSite: 'ร้านทดสอบ',
          mem_route: 'L1-1',
          currentPreference: null,
        },
      ]);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('marks which customers already have a preference set', async () => {
      userQueryBuilder.getManyAndCount.mockResolvedValue([
        [
          {
            mem_code: 'mem-001',
            mem_nameSite: 'ร้านทดสอบ 1',
            mem_route: 'L1-1',
          },
          {
            mem_code: 'mem-002',
            mem_nameSite: 'ร้านทดสอบ 2',
            mem_route: 'L23',
          },
        ],
        2,
      ]);
      cacheRepo.find.mockResolvedValue([
        { mem_code: 'mem-001', preference: 'van_only' },
      ]);
      const result = await service.listEligibleCustomers();
      expect(result.items[0].currentPreference).toBe('van_only');
      expect(result.items[1].currentPreference).toBeNull();
    });

    it('applies the keyword as an additional filter when provided', async () => {
      userQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      await service.listEligibleCustomers({ keyword: 'mem' });
      expect(userQueryBuilder.andWhere).toHaveBeenCalledWith(
        '(u.mem_code LIKE :kw OR u.mem_nameSite LIKE :kw)',
        { kw: '%mem%' },
      );
    });

    it('paginates using page and limit', async () => {
      userQueryBuilder.getManyAndCount.mockResolvedValue([[], 0]);
      const result = await service.listEligibleCustomers({
        page: 2,
        limit: 10,
      });
      expect(userQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(userQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });
  });

  describe('getEligibleRouteStats', () => {
    it('returns zero counts when no customer has a preference set', async () => {
      userRepo.count.mockResolvedValue(5);
      cacheQueryBuilder.getRawMany.mockResolvedValue([]);
      const result = await service.getEligibleRouteStats();
      expect(result.totalEligibleCustomers).toBe(5);
      expect(result.totalWithPreferenceSet).toBe(0);
      expect(result.breakdown).toEqual(
        DELIVERY_PREFERENCE_OPTIONS.map((o) => ({
          key: o.key,
          label: o.label,
          count: 0,
        })),
      );
    });

    it('maps raw counts onto each known preference option', async () => {
      userRepo.count.mockResolvedValue(10);
      cacheQueryBuilder.getRawMany.mockResolvedValue([
        { preference: 'van_only', count: '3' },
        { preference: 'delivery_always', count: '2' },
      ]);
      const result = await service.getEligibleRouteStats();
      expect(result.totalEligibleCustomers).toBe(10);
      expect(result.totalWithPreferenceSet).toBe(5);
      expect(result.breakdown.find((b) => b.key === 'van_only')?.count).toBe(3);
      expect(
        result.breakdown.find((b) => b.key === 'delivery_always')?.count,
      ).toBe(2);
      expect(
        result.breakdown.find((b) => b.key === 'van_or_delivery')?.count,
      ).toBe(0);
    });
  });
});
