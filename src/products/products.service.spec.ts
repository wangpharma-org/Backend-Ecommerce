import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductUnitEntity } from './product-unit.entity';
import { CreditorEntity } from './creditor.entity';
import { UserEntity } from 'src/users/users.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.enity';
import { BackendService } from 'src/backend/backend.service';
import { ElasticsearchService } from 'src/elasticsearch/elasticsearch.service';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';

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
    getCount: jest.fn().mockResolvedValue(0),
  }),
});

const UNITS_3_LEVELS = [
  { level: 1, unit_name: 'ชิ้น', ratio: 1 },
  { level: 2, unit_name: 'กล่อง', ratio: 12 },
  { level: 3, unit_name: 'ลัง', ratio: 144 },
];

describe('ProductsService — unit helpers', () => {
  let service: ProductsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(ProductEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ProductPharmaEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(CreditorEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ProductUnitEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ShoppingCartEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(DeleteCartEntity), useValue: mockRepo() },
        { provide: BackendService, useValue: {} },
        { provide: ElasticsearchService, useValue: {} },
        { provide: ShoppingCartService, useValue: {} },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── convertEnumToUnitName ────────────────────────────────────────────────

  describe('convertEnumToUnitName', () => {
    it('returns unit_name for level 1 (number input)', () => {
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

    it('falls back to string enum when units array is empty', () => {
      // implementation: returns String(unitEnum) as fallback when no units found
      expect((service as any).convertEnumToUnitName(1, [])).toBe('1');
    });

    it('falls back to string enum when units is undefined', () => {
      expect((service as any).convertEnumToUnitName(1, undefined)).toBe('1');
    });

    it('returns empty string when unitEnum is undefined', () => {
      expect((service as any).convertEnumToUnitName(undefined, UNITS_3_LEVELS)).toBe('');
    });

    it('returns empty string for level not found (e.g. 9)', () => {
      expect((service as any).convertEnumToUnitName(9, UNITS_3_LEVELS)).toBe('');
    });

    it('returns empty string when product has only level 1 and level 2 is requested', () => {
      const units = [{ level: 1, unit_name: 'ชิ้น', ratio: 1 }];
      expect((service as any).convertEnumToUnitName(2, units)).toBe('');
    });

    it('works correctly when product has only 1 unit level', () => {
      const units = [{ level: 1, unit_name: 'แผ่น', ratio: 1 }];
      expect((service as any).convertEnumToUnitName(1, units)).toBe('แผ่น');
    });
  });

  // ─── getRatioFromUnits ────────────────────────────────────────────────────

  describe('getRatioFromUnits', () => {
    it('returns ratio 1 for smallest unit (level 1)', () => {
      expect((service as any).getRatioFromUnits(1, UNITS_3_LEVELS)).toBe(1);
    });

    it('returns correct ratio for level 2', () => {
      expect((service as any).getRatioFromUnits(2, UNITS_3_LEVELS)).toBe(12);
    });

    it('returns correct ratio for level 3', () => {
      expect((service as any).getRatioFromUnits(3, UNITS_3_LEVELS)).toBe(144);
    });

    it('accepts string enum "2"', () => {
      expect((service as any).getRatioFromUnits('2', UNITS_3_LEVELS)).toBe(12);
    });

    it('returns 1 when units array is empty', () => {
      expect((service as any).getRatioFromUnits(2, [])).toBe(1);
    });

    it('returns 1 when units is undefined', () => {
      expect((service as any).getRatioFromUnits(2, undefined)).toBe(1);
    });

    it('returns 1 when unitEnum is undefined', () => {
      expect((service as any).getRatioFromUnits(undefined, UNITS_3_LEVELS)).toBe(1);
    });

    it('returns 1 for level not found in array', () => {
      expect((service as any).getRatioFromUnits(9, UNITS_3_LEVELS)).toBe(1);
    });

    it('handles large ratio values correctly', () => {
      const units = [
        { level: 1, unit_name: 'เม็ด', ratio: 1 },
        { level: 2, unit_name: 'แผง', ratio: 10 },
        { level: 3, unit_name: 'กล่อง', ratio: 1000 },
      ];
      expect((service as any).getRatioFromUnits(3, units)).toBe(1000);
    });
  });
});
