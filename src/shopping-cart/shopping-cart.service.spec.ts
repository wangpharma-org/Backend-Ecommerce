import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShoppingCartService } from './shopping-cart.service';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { DeleteCartEntity } from './delete-cart.entity';
import { ProductEntity } from 'src/products/products.entity';
import { UserEntity } from 'src/users/users.entity';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { ProductsService } from 'src/products/products.service';
import { HotdealService } from 'src/hotdeal/hotdeal.service';
import { CompanyDayAnalyticService } from 'src/company-day-analytic/company-day-analytic.service';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import { PreorderProductEntity } from 'src/preorder/preorder-product.entity';

const mockRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findAndCount: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue({
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    setParameter: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
  }),
});

const UNITS_3_LEVELS: ProductUnitEntity[] = [
  { id: 1, pro_code: 'A001', unit_name: 'ชิ้น', ratio: 1, level: 1 } as ProductUnitEntity,
  { id: 2, pro_code: 'A001', unit_name: 'กล่อง', ratio: 12, level: 2 } as ProductUnitEntity,
  { id: 3, pro_code: 'A001', unit_name: 'ลัง', ratio: 144, level: 3 } as ProductUnitEntity,
];

const mockProduct = (units: ProductUnitEntity[] = UNITS_3_LEVELS): ProductEntity =>
  ({ pro_code: 'A001', units } as unknown as ProductEntity);

describe('ShoppingCartService — unit helpers', () => {
  let service: ShoppingCartService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShoppingCartService,
        { provide: getRepositoryToken(ShoppingCartEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PromotionTierEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PromotionConditionEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PromotionEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(ProductEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(DeleteCartEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(HotdealEntity), useValue: mockRepo() },
        { provide: getRepositoryToken(PreorderProductEntity), useValue: mockRepo() },
        { provide: ProductsService, useValue: { transformProductWithUnits: jest.fn() } },
        { provide: HotdealService, useValue: {} },
        { provide: CompanyDayAnalyticService, useValue: {} },
      ],
    }).compile();

    service = module.get<ShoppingCartService>(ShoppingCartService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── convertEnumToUnitName (signature: enum, unit1, unit2, unit3) ─────────

  describe('convertEnumToUnitName', () => {
    it('returns pro_unit1 for enum "1"', () => {
      expect((service as any).convertEnumToUnitName('1', 'ชิ้น', 'กล่อง', 'ลัง')).toBe('ชิ้น');
    });

    it('returns pro_unit2 for enum "2"', () => {
      expect((service as any).convertEnumToUnitName('2', 'ชิ้น', 'กล่อง', 'ลัง')).toBe('กล่อง');
    });

    it('returns pro_unit3 for enum "3"', () => {
      expect((service as any).convertEnumToUnitName('3', 'ชิ้น', 'กล่อง', 'ลัง')).toBe('ลัง');
    });

    it('accepts number input 1', () => {
      expect((service as any).convertEnumToUnitName(1, 'ชิ้น', 'กล่อง', 'ลัง')).toBe('ชิ้น');
    });

    it('accepts number input 2', () => {
      expect((service as any).convertEnumToUnitName(2, 'ชิ้น', 'กล่อง', 'ลัง')).toBe('กล่อง');
    });

    it('returns empty string for null enum', () => {
      expect((service as any).convertEnumToUnitName(null, 'ชิ้น', 'กล่อง', 'ลัง')).toBe('');
    });

    it('returns empty string for undefined enum', () => {
      expect((service as any).convertEnumToUnitName(undefined, 'ชิ้น', 'กล่อง', 'ลัง')).toBe('');
    });

    it('returns empty string for unknown enum value', () => {
      expect((service as any).convertEnumToUnitName('9', 'ชิ้น', 'กล่อง', 'ลัง')).toBe('');
    });

    it('returns empty string when unit name is empty string for the requested level', () => {
      expect((service as any).convertEnumToUnitName('2', 'ชิ้น', '', 'ลัง')).toBe('');
    });

    it('works when product has only 1 unit (level 2 and 3 empty)', () => {
      expect((service as any).convertEnumToUnitName('1', 'แผ่น', '', '')).toBe('แผ่น');
      expect((service as any).convertEnumToUnitName('2', 'แผ่น', '', '')).toBe('');
    });
  });

  // ─── getUnitRatio ─────────────────────────────────────────────────────────

  describe('getUnitRatio', () => {
    it('returns ratio for level 1', () => {
      const product = mockProduct();
      expect((service as any).getUnitRatio(product, '1')).toBe(1);
    });

    it('returns ratio for level 2', () => {
      const product = mockProduct();
      expect((service as any).getUnitRatio(product, '2')).toBe(12);
    });

    it('returns ratio for level 3', () => {
      const product = mockProduct();
      expect((service as any).getUnitRatio(product, '3')).toBe(144);
    });

    it('returns 1 when unitEnum is null', () => {
      const product = mockProduct();
      expect((service as any).getUnitRatio(product, null)).toBe(1);
    });

    it('returns 1 when unitEnum is undefined', () => {
      const product = mockProduct();
      expect((service as any).getUnitRatio(product, undefined)).toBe(1);
    });

    it('returns 1 when product has no units relation loaded', () => {
      const product = mockProduct([]);
      expect((service as any).getUnitRatio(product, '1')).toBe(1);
    });

    it('returns 1 for level not in product units', () => {
      const product = mockProduct([
        { id: 1, pro_code: 'A001', unit_name: 'ชิ้น', ratio: 1, level: 1 } as ProductUnitEntity,
      ]);
      expect((service as any).getUnitRatio(product, '2')).toBe(1);
    });
  });

  // ─── convertUnitNameToEnum ────────────────────────────────────────────────

  describe('convertUnitNameToEnum', () => {
    it('returns "1" for unit name at level 1', () => {
      const product = mockProduct();
      expect((service as any).convertUnitNameToEnum('ชิ้น', product)).toBe('1');
    });

    it('returns "2" for unit name at level 2', () => {
      const product = mockProduct();
      expect((service as any).convertUnitNameToEnum('กล่อง', product)).toBe('2');
    });

    it('returns "3" for unit name at level 3', () => {
      const product = mockProduct();
      expect((service as any).convertUnitNameToEnum('ลัง', product)).toBe('3');
    });

    // หน่วยไม่ตรง/ไม่มี ต้องปฏิเสธ (400) ไม่ใช่เดาเป็น level 1 — ไม่งั้นราคาคิดผิดหน่วยเงียบๆ
    it('throws BadRequest when unit name is not found', () => {
      const product = mockProduct();
      expect(() => (service as any).convertUnitNameToEnum('ไม่มีหน่วยนี้', product)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when product has no units', () => {
      const product = mockProduct([]);
      expect(() => (service as any).convertUnitNameToEnum('ชิ้น', product)).toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when units is undefined on product', () => {
      const product = { pro_code: 'A001', units: undefined } as unknown as ProductEntity;
      expect(() => (service as any).convertUnitNameToEnum('ชิ้น', product)).toThrow(
        BadRequestException,
      );
    });

    it('returns correct enum for product with only 1 unit', () => {
      const product = mockProduct([
        { id: 1, pro_code: 'A001', unit_name: 'ซอง', ratio: 1, level: 1 } as ProductUnitEntity,
      ]);
      expect((service as any).convertUnitNameToEnum('ซอง', product)).toBe('1');
    });
  });
});

describe('ShoppingCartService — Sale cart snapshot', () => {
  it('returns a narrow projection without invoking cart mutation operations', async () => {
    const rows = [
      {
        pro_code: 'A001',
        pro_name: 'Product A',
        pro_imgmain: 'a.jpg',
        spc_id: 12,
        spc_amount: '2.50',
        spc_unit_enum: '2',
        spc_checked: 1,
        basket_id: null,
        is_reward: 0,
        hotdeal_free: 0,
        spc_fixed_total: null,
        unit_level: 1,
        unit_name: 'ชิ้น',
      },
      {
        pro_code: 'A001',
        pro_name: 'Product A',
        pro_imgmain: 'a.jpg',
        spc_id: 12,
        spc_amount: '2.50',
        spc_unit_enum: '2',
        spc_checked: 1,
        basket_id: null,
        is_reward: 0,
        hotdeal_free: 0,
        spc_fixed_total: null,
        unit_level: 2,
        unit_name: 'กล่อง',
      },
      {
        pro_code: 'B002',
        pro_name: null,
        pro_imgmain: null,
        spc_id: 13,
        spc_amount: '1.00',
        spc_unit_enum: '1',
        spc_checked: 0,
        basket_id: 9,
        is_reward: 0,
        hotdeal_free: 0,
        spc_fixed_total: null,
        unit_level: 1,
        unit_name: 'แผ่น',
      },
    ];
    const queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue(rows),
      delete: jest.fn(),
      execute: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
      update: jest.fn(),
    };
    const testService = Object.assign(
      Object.create(ShoppingCartService.prototype),
      {
        shoppingCartRepo: {
          createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
        },
      },
    ) as ShoppingCartService;
    jest
      .spyOn(testService, 'getCartVersionState')
      .mockResolvedValue({ cartVersion: '8', cartSyncedAt: null });

    await expect(testService.getSaleCartSnapshot('M001')).resolves.toEqual({
      cart: [
        {
          pro_code: 'A001',
          pro_name: 'Product A',
          pro_imgmain: 'a.jpg',
          shopping_cart: [
            { spc_id: 12, spc_amount: '2.50', spc_unit: 'กล่อง', spc_checked: 1, editable: true },
          ],
        },
        {
          pro_code: 'B002',
          pro_name: null,
          pro_imgmain: null,
          shopping_cart: [
            { spc_id: 13, spc_amount: '1.00', spc_unit: 'แผ่น', spc_checked: 0, editable: false },
          ],
        },
      ],
      cartVersion: '8',
      cartSyncedAt: null,
    });
    expect(queryBuilder.delete).not.toHaveBeenCalled();
    expect(queryBuilder.execute).not.toHaveBeenCalled();
    expect(queryBuilder.save).not.toHaveBeenCalled();
    expect(queryBuilder.remove).not.toHaveBeenCalled();
    expect(queryBuilder.update).not.toHaveBeenCalled();
  });
});
