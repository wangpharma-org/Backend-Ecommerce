import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductsService } from './products.service';
import { ProductEntity } from './products.entity';
import { ProductPharmaEntity } from './product-pharma.entity';
import { ProductUnitEntity } from './product-unit.entity';
import { CreditorEntity } from './creditor.entity';
import { UserEntity } from 'src/users/users.entity';
import { ShoppingCartEntity } from 'src/shopping-cart/shopping-cart.entity';
import { DeleteCartEntity } from 'src/shopping-cart/delete-cart.entity';
import { BackendService } from 'src/backend/backend.service';
import { ElasticsearchService } from 'src/elasticsearch/elasticsearch.service';
import { ShoppingCartService } from 'src/shopping-cart/shopping-cart.service';
import { RedeemProductSetService } from 'src/fix-free/redeem-product-set.service';
import { MonthlyDealPublisherService } from './monthly-deal-publisher.service';
import { ProductLabelRulesService } from 'src/product-label-rules/product-label-rules.service';

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
        {
          provide: getRepositoryToken(ProductPharmaEntity),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(CreditorEntity), useValue: mockRepo() },
        {
          provide: getRepositoryToken(ProductUnitEntity),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo() },
        {
          provide: getRepositoryToken(ShoppingCartEntity),
          useValue: mockRepo(),
        },
        { provide: getRepositoryToken(DeleteCartEntity), useValue: mockRepo() },
        { provide: BackendService, useValue: {} },
        { provide: ElasticsearchService, useValue: {} },
        { provide: ShoppingCartService, useValue: {} },
        {
          provide: ProductLabelRulesService,
          useValue: {
            attachToProducts: jest.fn((products: unknown[]) =>
              Promise.resolve(products),
            ),
          },
        },
        {
          provide: RedeemProductSetService,
          useValue: { getCustomerSet: jest.fn() },
        },
        {
          provide: MonthlyDealPublisherService,
          useValue: { publishSnapshot: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('includes the English name in the product detail response', async () => {
    const product = {
      pro_code: 'P001',
      pro_name: 'Thai product name',
      pro_nameEN: 'English product name',
    };
    const queryBuilder: Record<string, jest.Mock> = {};
    for (const method of ['leftJoinAndSelect', 'select', 'where']) {
      queryBuilder[method] = jest.fn(() => queryBuilder);
    }
    queryBuilder.getOne = jest.fn().mockResolvedValue(product);

    Object.assign(service, {
      productRepo: {
        increment: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest.fn(() => queryBuilder),
      },
      isL16Member: jest.fn().mockResolvedValue(false),
      transformProductWithUnits: jest
        .fn()
        .mockImplementation((value) => Promise.resolve(value)),
    });

    const result = await service.getProductDetail({
      pro_code: product.pro_code,
      mem_code: 'TEST',
    });

    expect(result.pro_nameEN).toBe(product.pro_nameEN);
    expect(queryBuilder.select).toHaveBeenCalledWith(
      expect.arrayContaining(['product.pro_nameEN']),
    );
  });

  // ─── convertEnumToUnitName ────────────────────────────────────────────────

  describe('convertEnumToUnitName', () => {
    it('returns unit_name for level 1 (number input)', () => {
      expect((service as any).convertEnumToUnitName(1, UNITS_3_LEVELS)).toBe(
        'ชิ้น',
      );
    });

    it('returns unit_name for level 2', () => {
      expect((service as any).convertEnumToUnitName(2, UNITS_3_LEVELS)).toBe(
        'กล่อง',
      );
    });

    it('returns unit_name for level 3', () => {
      expect((service as any).convertEnumToUnitName(3, UNITS_3_LEVELS)).toBe(
        'ลัง',
      );
    });

    it('accepts string enum "1"', () => {
      expect((service as any).convertEnumToUnitName('1', UNITS_3_LEVELS)).toBe(
        'ชิ้น',
      );
    });

    it('accepts string enum "2"', () => {
      expect((service as any).convertEnumToUnitName('2', UNITS_3_LEVELS)).toBe(
        'กล่อง',
      );
    });

    it('accepts string enum "3"', () => {
      expect((service as any).convertEnumToUnitName('3', UNITS_3_LEVELS)).toBe(
        'ลัง',
      );
    });

    it('falls back to string enum when units array is empty', () => {
      // implementation: returns String(unitEnum) as fallback when no units found
      expect((service as any).convertEnumToUnitName(1, [])).toBe('1');
    });

    it('falls back to string enum when units is undefined', () => {
      expect((service as any).convertEnumToUnitName(1, undefined)).toBe('1');
    });

    it('returns empty string when unitEnum is undefined', () => {
      expect(
        (service as any).convertEnumToUnitName(undefined, UNITS_3_LEVELS),
      ).toBe('');
    });

    it('returns empty string for level not found (e.g. 9)', () => {
      expect((service as any).convertEnumToUnitName(9, UNITS_3_LEVELS)).toBe(
        '',
      );
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
      expect(
        (service as any).getRatioFromUnits(undefined, UNITS_3_LEVELS),
      ).toBe(1);
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

  // ─── searchProductsElastic — DB fallback ─────────────────────────────────

  describe('searchProductsElastic DB fallback', () => {
    const makeQb = (rows: unknown[] = [], raw: unknown[] = []) => {
      const qb: Record<string, jest.Mock> = {};
      for (const method of [
        'leftJoinAndSelect',
        'innerJoinAndSelect',
        'innerJoin',
        'setParameter',
        'select',
        'where',
        'andWhere',
        'orderBy',
        'limit',
      ]) {
        qb[method] = jest.fn(() => qb);
      }
      qb.getMany = jest.fn().mockResolvedValue(rows);
      qb.getRawMany = jest.fn().mockResolvedValue(raw);
      return qb;
    };
    const product = (pro_code: string, pro_name = 'พาราเซตามอล') => ({
      pro_code,
      pro_name,
      pro_priceA: 10,
      pro_priceB: 10,
      pro_priceC: 10,
    });
    const esResult = (codes: string[]) => ({
      hits: {
        total: { value: codes.length },
        hits: codes.map((pro_code) => ({ _source: { pro_code } })),
      },
    });

    const setup = (opts: {
      esCodes: string[];
      external?: string[];
      enter?: string[];
      dbCodes?: string[];
      dbRows: ReturnType<typeof product>[];
    }) => {
      const qb = makeQb(opts.dbRows);
      const fallback = jest.fn().mockResolvedValue(opts.dbCodes ?? []);
      Object.assign(service, {
        productRepo: { createQueryBuilder: jest.fn(() => qb) },
        elasticsearchService: {
          search: jest.fn().mockResolvedValue(esResult(opts.esCodes)),
        },
        isL16Member: jest.fn().mockResolvedValue(false),
        searchExternalProducts: jest
          .fn()
          .mockResolvedValue((opts.external ?? []).map((c) => product(c))),
        searchEnterProducts: jest.fn().mockResolvedValue(opts.enter ?? []),
        searchProductCodesFromDb: fallback,
        transformProductWithUnits: jest.fn((p) => Promise.resolve(p)),
        attachProductLabels: jest.fn().mockResolvedValue(undefined),
      });
      return { fallback, qb };
    };
    const search = (keyword = 'พารา') =>
      service.searchProductsElastic({
        keyword,
        offset: 0,
        limit: 20,
        mem_code: 'TEST',
      });

    it('falls back to the DB when ES and the old website find nothing', async () => {
      const { fallback } = setup({
        esCodes: [],
        dbCodes: ['P1', 'P2'],
        dbRows: [product('P2'), product('P1')],
      });

      const result = await search();

      expect(fallback).toHaveBeenCalledWith({
        keyword: 'พารา',
        isL16: false,
        creditor_codes: undefined,
      });
      expect(result.products.map((p) => p.pro_code)).toEqual(['P1', 'P2']);
      expect(result.totalCount).toBe(2);
    });

    it('does not hit the DB fallback when the old website finds products', async () => {
      const { fallback } = setup({
        esCodes: [],
        external: ['E1'],
        dbRows: [product('E1')],
      });

      const result = await search();

      expect(fallback).not.toHaveBeenCalled();
      expect(result.products.map((p) => p.pro_code)).toEqual(['E1']);
    });

    it('does not hit the DB fallback when ES finds products', async () => {
      const { fallback } = setup({ esCodes: ['S1'], dbRows: [product('S1')] });

      await search();

      expect(fallback).not.toHaveBeenCalled();
      expect(service.searchExternalProducts).not.toHaveBeenCalled();
    });

    it('still drops free-gift rows returned by the DB fallback', async () => {
      setup({
        esCodes: [],
        dbCodes: ['P1', 'F1'],
        dbRows: [product('P1'), product('F1', 'ฟรี ยาดม')],
      });

      const result = await search();

      expect(result.products.map((p) => p.pro_code)).toEqual(['P1']);
      expect(result.totalCount).toBe(1);
    });

    it('escapes LIKE wildcards and filters L16-only products for non-L16 shops', async () => {
      const qb = makeQb([], [{ pro_code: 'P1' }]);
      Object.assign(service, {
        productRepo: { createQueryBuilder: jest.fn(() => qb) },
      });

      const codes = await (service as any).searchProductCodesFromDb({
        keyword: '50%_a',
        isL16: false,
      });

      expect(codes).toEqual(['P1']);
      const sub = { orWhere: jest.fn() };
      qb.where.mock.calls[0][0].whereFactory(sub);
      expect(sub.orWhere).toHaveBeenCalledWith('product.pro_name LIKE :like', {
        like: '%50\\%\\_a%',
      });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(product.pro_l16_only = 0 OR product.pro_l16_only IS NULL)',
      );
      expect(qb.innerJoin).not.toHaveBeenCalled();
    });
  });
});
