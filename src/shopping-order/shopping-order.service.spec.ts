import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ShoppingOrderService } from './shopping-order.service';
import { ShoppingOrderEntity } from './shopping-order.entity';
import { ShoppingHeadEntity } from 'src/shopping-head/shopping-head.entity';
import { SaleLogEntity } from './salelog-order.entity';
import { FailedEntity } from 'src/failed-api/failed-api.entity';
import { ProductEntity } from 'src/products/products.entity';
import { PromotionRewardEntity } from 'src/promotion/promotion-reward.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { UserEntity } from 'src/users/users.entity';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { CompanyDayAnalyticService } from 'src/company-day-analytic/company-day-analytic.service';
import { PromotionService } from 'src/promotion/promotion.service';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
  }),
});

const UNITS_3_LEVELS = [
  { level: 1, unit_name: 'ชิ้น', ratio: 1 },
  { level: 2, unit_name: 'กล่อง', ratio: 12 },
  { level: 3, unit_name: 'ลัง', ratio: 144 },
];

describe('ShoppingOrderService — unit helpers', () => {
  let service: ShoppingOrderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingOrderService,
        { provide: getRepositoryToken(ShoppingHeadEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ShoppingOrderEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(FailedEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ProductEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(SaleLogEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PromotionRewardEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PromotionTierEntity), useValue: mockRepo() },
        { provide: ShoppingCartService, useValue: {} },
        { provide: HttpService, useValue: {} },
        { provide: DataSource, useValue: { transaction: jest.fn(), createQueryRunner: jest.fn() } },
        { provide: CompanyDayAnalyticService, useValue: {} },
        { provide: PromotionService, useValue: {} },
      ],
    }).compile();

    service = module.get<ShoppingOrderService>(ShoppingOrderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── convertEnumToUnitName (signature: enum, units[]) ────────────────────

  describe('convertEnumToUnitName', () => {
    it('returns unit_name for level 1', () => {
      expect((service as any).convertEnumToUnitName(1, UNITS_3_LEVELS)).toBe('ชิ้น');
    });

    it('returns unit_name for level 2', () => {
      expect((service as any).convertEnumToUnitName(2, UNITS_3_LEVELS)).toBe('กล่อง');
    });

    it('returns unit_name for level 3', () => {
      expect((service as any).convertEnumToUnitName(3, UNITS_3_LEVELS)).toBe('ลัง');
    });

    it('accepts string enum "1"', () => {
      expect((service as any).convertEnumToUnitName('1', UNITS_3_LEVELS)).toBe('ชิ้น');
    });

    it('accepts string enum "2"', () => {
      expect((service as any).convertEnumToUnitName('2', UNITS_3_LEVELS)).toBe('กล่อง');
    });

    it('accepts string enum "3"', () => {
      expect((service as any).convertEnumToUnitName('3', UNITS_3_LEVELS)).toBe('ลัง');
    });

    it('returns empty string when units array is empty', () => {
      expect((service as any).convertEnumToUnitName('1', [])).toBe('');
    });

    it('returns empty string when units is undefined', () => {
      expect((service as any).convertEnumToUnitName('1', undefined)).toBe('');
    });

    it('falls back to string of enum when level not found', () => {
      // shopping-order: returns String(unitEnum) as fallback (not empty string)
      expect((service as any).convertEnumToUnitName('2', [
        { level: 1, unit_name: 'ชิ้น', ratio: 1 },
      ])).toBe('2');
    });
  });

  // ─── getRatioFromUnits ────────────────────────────────────────────────────

  describe('getRatioFromUnits', () => {
    it('returns ratio for level 1', () => {
      expect((service as any).getRatioFromUnits(1, UNITS_3_LEVELS)).toBe(1);
    });

    it('returns ratio for level 2', () => {
      expect((service as any).getRatioFromUnits(2, UNITS_3_LEVELS)).toBe(12);
    });

    it('returns ratio for level 3', () => {
      expect((service as any).getRatioFromUnits(3, UNITS_3_LEVELS)).toBe(144);
    });

    it('accepts string enum "3"', () => {
      expect((service as any).getRatioFromUnits('3', UNITS_3_LEVELS)).toBe(144);
    });

    it('returns 1 when units array is empty', () => {
      expect((service as any).getRatioFromUnits(2, [])).toBe(1);
    });

    it('returns 1 when units is undefined', () => {
      expect((service as any).getRatioFromUnits(2, undefined)).toBe(1);
    });

    it('returns 1 for level not found in array', () => {
      expect((service as any).getRatioFromUnits(9, UNITS_3_LEVELS)).toBe(1);
    });

    it('returns 1 when unitEnum is undefined', () => {
      expect((service as any).getRatioFromUnits(undefined, UNITS_3_LEVELS)).toBe(1);
    });

    it('handles ratio conversion: 1 ลัง = 144 ชิ้น correctly', () => {
      const amount = 2;
      const ratio = (service as any).getRatioFromUnits(3, UNITS_3_LEVELS);
      expect(amount * ratio).toBe(288);
    });
  });
});
