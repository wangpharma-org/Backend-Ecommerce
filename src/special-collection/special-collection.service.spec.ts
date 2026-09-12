import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SpecialCollectionService } from './special-collection.service';
import { SpecialCollectionEntity } from './special-collection.entity';
import { SpecialCollectionItemEntity } from './special-collection-item.entity';
import { SpecialCollectionAudienceEntity } from './special-collection-audience.entity';
import { PromotionEntity } from '../promotion/promotion.entity';
import { PromotionTierEntity } from '../promotion/promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';
import { HotdealEntity } from '../hotdeal/hotdeal.entity';
import { FlashSaleEntity } from '../flashsale/flashsale.entity';
import { UserEntity } from '../users/users.entity';
import { BundleSetEntity } from '../bundle-set/bundle-set.entity';
import { BundleSetService } from '../bundle-set/bundle-set.service';

/**
 * SpecialCollectionService unit tests
 * เน้นจุดที่พังเงียบได้: การ validate ref, ลำดับรายการ, และการกรองของที่ถูกลบ
 */

const buildRepoMock = () => ({
  // ค่าเริ่มต้นต้องเป็นลิสต์ว่าง ไม่ใช่ undefined — loadDisplayNames วน for..of ผลลัพธ์ทุกตัว
  // เทสที่ไม่ได้สนใจชื่อที่แสดงจะได้ไม่ล้มด้วย "is not iterable"
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((row: unknown) => row),
  delete: jest.fn(),
  update: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const buildItem = (
  overrides: Partial<SpecialCollectionItemEntity> = {},
): SpecialCollectionItemEntity =>
  ({
    item_id: 1,
    collection_id: 1,
    ref_type: 'product',
    ref_id: 'P-001',
    title_override: null,
    sort_order: 0,
    created_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  }) as SpecialCollectionItemEntity;

describe('SpecialCollectionService', () => {
  let service: SpecialCollectionService;
  let collectionRepo: ReturnType<typeof buildRepoMock>;
  let itemRepo: ReturnType<typeof buildRepoMock>;
  let audienceRepo: ReturnType<typeof buildRepoMock>;
  let promotionRepo: ReturnType<typeof buildRepoMock>;
  let tierRepo: ReturnType<typeof buildRepoMock>;
  let productRepo: ReturnType<typeof buildRepoMock>;
  let hotdealRepo: ReturnType<typeof buildRepoMock>;
  let flashsaleRepo: ReturnType<typeof buildRepoMock>;
  let userRepo: ReturnType<typeof buildRepoMock>;
  let bundleSetRepo: ReturnType<typeof buildRepoMock>;
  let bundleSetService: { getSetView: jest.Mock };

  beforeEach(async () => {
    collectionRepo = buildRepoMock();
    itemRepo = buildRepoMock();
    audienceRepo = buildRepoMock();
    promotionRepo = buildRepoMock();
    tierRepo = buildRepoMock();
    productRepo = buildRepoMock();
    hotdealRepo = buildRepoMock();
    flashsaleRepo = buildRepoMock();
    userRepo = buildRepoMock();
    bundleSetRepo = buildRepoMock();
    bundleSetService = { getSetView: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpecialCollectionService,
        {
          provide: getRepositoryToken(SpecialCollectionEntity),
          useValue: collectionRepo,
        },
        {
          provide: getRepositoryToken(SpecialCollectionItemEntity),
          useValue: itemRepo,
        },
        {
          provide: getRepositoryToken(SpecialCollectionAudienceEntity),
          useValue: audienceRepo,
        },
        {
          provide: getRepositoryToken(PromotionEntity),
          useValue: promotionRepo,
        },
        {
          provide: getRepositoryToken(PromotionTierEntity),
          useValue: tierRepo,
        },
        { provide: getRepositoryToken(ProductEntity), useValue: productRepo },
        { provide: getRepositoryToken(HotdealEntity), useValue: hotdealRepo },
        {
          provide: getRepositoryToken(FlashSaleEntity),
          useValue: flashsaleRepo,
        },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        {
          provide: getRepositoryToken(BundleSetEntity),
          useValue: bundleSetRepo,
        },
        { provide: BundleSetService, useValue: bundleSetService },
      ],
    }).compile();

    service = module.get<SpecialCollectionService>(SpecialCollectionService);
  });

  describe('addItem', () => {
    beforeEach(() => {
      collectionRepo.findOne.mockResolvedValue({ collection_id: 1 });
    });

    it('ปฏิเสธ ref_id ที่ไม่ใช่ตัวเลขสำหรับ promotion', async () => {
      await expect(
        service.addItem(1, { ref_type: 'promotion', ref_id: '2a0 ' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(promotionRepo.findOne).not.toHaveBeenCalled();
    });

    it('ปฏิเสธเมื่อ ref ที่อ้างถึงไม่มีอยู่จริง', async () => {
      promotionRepo.findOne.mockResolvedValue(null);
      await expect(
        service.addItem(1, { ref_type: 'promotion', ref_id: '184' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ปฏิเสธรายการซ้ำในคอลเลกชันเดียวกัน', async () => {
      promotionRepo.findOne.mockResolvedValue({ promo_id: 184 });
      itemRepo.findOne.mockResolvedValue(buildItem());

      await expect(
        service.addItem(1, { ref_type: 'promotion', ref_id: '184' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(itemRepo.save).not.toHaveBeenCalled();
    });

    it('รับ bundle_set ที่มีอยู่จริงได้ (ref_id เป็น set_code ไม่ใช่ตัวเลข)', async () => {
      bundleSetRepo.findOne.mockResolvedValue({ set_code: 'SET-DIA-X' });
      itemRepo.findOne.mockResolvedValue(null);
      itemRepo.save.mockImplementation((row: unknown) => row);

      const saved = await service.addItem(1, {
        ref_type: 'bundle_set',
        ref_id: 'SET-DIA-X',
      });

      expect(saved.ref_id).toBe('SET-DIA-X');
      expect(bundleSetRepo.findOne).toHaveBeenCalled();
    });

    it('ปฏิเสธ bundle_set ที่ไม่มีอยู่จริง', async () => {
      bundleSetRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addItem(1, { ref_type: 'bundle_set', ref_id: 'SET-GONE' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('ต่อ sort_order จากรายการสุดท้ายเมื่อไม่ได้ระบุมา', async () => {
      promotionRepo.findOne.mockResolvedValue({ promo_id: 184 });
      itemRepo.findOne
        .mockResolvedValueOnce(null) // duplicate check
        .mockResolvedValueOnce(buildItem({ sort_order: 4 })); // last item
      itemRepo.save.mockImplementation((row: unknown) => row);

      const saved = await service.addItem(1, {
        ref_type: 'promotion',
        ref_id: '184',
      });

      expect(saved.sort_order).toBe(5);
    });
  });

  describe('reorderItems', () => {
    it('ปฏิเสธเมื่อมี item_id ที่ไม่ได้อยู่ในคอลเลกชัน', async () => {
      itemRepo.find.mockResolvedValue([buildItem({ item_id: 1 })]);

      await expect(
        service.reorderItems(1, { item_ids: [1, 99] }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(itemRepo.update).not.toHaveBeenCalled();
    });

    it('ปฏิเสธเมื่อส่ง item_ids มาไม่ครบ — กันรายการตกหล่นเงียบ', async () => {
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1 }),
        buildItem({ item_id: 2 }),
      ]);

      await expect(
        service.reorderItems(1, { item_ids: [1] }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('เขียน sort_order ตามลำดับที่ส่งมา', async () => {
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1 }),
        buildItem({ item_id: 2 }),
      ]);
      itemRepo.update.mockResolvedValue(undefined);

      await service.reorderItems(1, { item_ids: [2, 1] });

      expect(itemRepo.update).toHaveBeenCalledWith(
        { item_id: 2 },
        { sort_order: 0 },
      );
      expect(itemRepo.update).toHaveBeenCalledWith(
        { item_id: 1 },
        { sort_order: 1 },
      );
    });
  });

  /** loadPromotions ใช้ query builder เพราะต้องกรอง status + ช่วงวันที่ */
  const mockPromotionQuery = (rows: Array<Record<string, unknown>>) => {
    promotionRepo.createQueryBuilder.mockReturnValue({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
    });
  };

  describe('getForMember', () => {
    const mockVisibleCollections = (
      rows: Array<Partial<SpecialCollectionEntity>>,
    ) => {
      collectionRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(rows),
      });
    };

    it('คืนค่าว่างเมื่อร้านนี้ไม่เห็นคอลเลกชันใดเลย', async () => {
      mockVisibleCollections([]);

      const result = await service.getForMember('CUST-00123');

      expect(result).toEqual({ collections: [], total_items: 0 });
      expect(itemRepo.find).not.toHaveBeenCalled();
    });

    it('ตัดรายการที่ของถูกลบไปแล้วออก และนับ total_items เฉพาะที่เหลือ', async () => {
      mockVisibleCollections([{ collection_id: 1, name: 'ชุดสินค้าพิเศษ' }]);
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1, ref_id: 'P-001', sort_order: 0 }),
        buildItem({ item_id: 2, ref_id: 'P-GONE', sort_order: 1 }),
      ]);
      // P-GONE ไม่ถูกคืนมาจาก repo = ถูกลบไปแล้ว
      productRepo.find.mockResolvedValue([
        { pro_code: 'P-001', pro_name: 'สินค้าทดสอบ' },
      ]);

      const result = await service.getForMember('CUST-00123');

      expect(result.total_items).toBe(1);
      expect(result.collections[0].items).toHaveLength(1);
      expect(result.collections[0].items[0].ref_id).toBe('P-001');
    });

    it('จับคู่ payload กับ item ให้ถูกตัวเมื่อมีหลายชนิดปนกัน', async () => {
      mockVisibleCollections([{ collection_id: 1, name: 'รวมโปร' }]);
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1, ref_type: 'product', ref_id: 'P-001' }),
        buildItem({ item_id: 2, ref_type: 'promotion', ref_id: '184' }),
      ]);
      productRepo.find.mockResolvedValue([
        { pro_code: 'P-001', pro_name: 'สินค้าทดสอบ' },
      ]);
      mockPromotionQuery([
        { promo_id: 184, promo_name: 'Bangkok Payday', tiers: [] },
      ]);

      const { collections } = await service.getForMember('CUST-00123');
      const [first, second] = collections[0].items;

      expect(first.ref_type).toBe('product');
      expect((first.payload as { pro_code: string }).pro_code).toBe('P-001');
      expect(second.ref_type).toBe('promotion');
      expect((second.payload as { promo_id: number }).promo_id).toBe(184);
    });

    it('กระเช้าต้องคืน view ที่คำนวณแล้ว ไม่ใช่ entity ดิบ (กันหน้าขาว)', async () => {
      mockVisibleCollections([{ collection_id: 1, name: 'รวมโปร' }]);
      itemRepo.find.mockResolvedValue([
        buildItem({
          item_id: 1,
          ref_type: 'bundle_set',
          ref_id: 'SET-DEMO-01',
        }),
      ]);
      bundleSetRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ set_code: 'SET-DEMO-01' }]),
      });
      bundleSetService.getSetView.mockResolvedValue({
        set_code: 'SET-DEMO-01',
        set_name: 'กระเช้าทดสอบ',
        price: 89,
        list_total: 110,
        savings: 21,
        items: [],
        gifts: [],
        availability: { available_sets: 30, limiting_pro_code: 'P-001' },
      });

      const { collections } = await service.getForMember('CUST-00123', 'C');
      const payload = collections[0].items[0].payload as {
        availability?: { available_sets: number };
        savings?: number;
      };

      // ฟิลด์พวกนี้มีเฉพาะใน view — ถ้าคืน entity ดิบจะ undefined แล้วหน้าบ้านพัง
      expect(payload.availability?.available_sets).toBe(30);
      expect(payload.savings).toBe(21);
      expect(bundleSetService.getSetView).toHaveBeenCalledWith(
        'SET-DEMO-01',
        'C',
      );
    });

    it('ตัดโปรที่หมดอายุ/ปิดอยู่ออก — query คืนค่าว่างจะได้ไม่โชว์ของกดไม่ได้', async () => {
      mockVisibleCollections([{ collection_id: 1, name: 'รวมโปร' }]);
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1, ref_type: 'promotion', ref_id: '184' }),
      ]);
      // โปรหมดอายุ → query กรองออก คืนอาร์เรย์ว่าง
      mockPromotionQuery([]);

      const result = await service.getForMember('CUST-00123');

      expect(result.total_items).toBe(0);
      expect(result.collections[0].items).toHaveLength(0);
    });
  });

  describe('getBadgeCount', () => {
    it('นับเฉพาะรายการที่ยังใช้งานได้', async () => {
      collectionRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ collection_id: 1, name: 'x' }]),
      });
      itemRepo.find.mockResolvedValue([
        buildItem({ item_id: 1, ref_id: 'P-001' }),
        buildItem({ item_id: 2, ref_id: 'P-GONE' }),
      ]);
      productRepo.find.mockResolvedValue([{ pro_code: 'P-001' }]);

      await expect(service.getBadgeCount('CUST-00123')).resolves.toEqual({
        count: 1,
      });
    });
  });

  describe('searchShops', () => {
    it('ปฏิเสธคำค้นที่สั้นเกินไป — กันดึงทั้งตาราง', async () => {
      await expect(service.searchShops('ก')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('คืนรหัสร้านพร้อมชื่อร้าน', async () => {
      userRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([
            { mem_code: '0131', mem_nameSite: 'ร้านขายยาโชคชัยเภสัช' },
          ]),
      });

      await expect(service.searchShops('โชคชัย')).resolves.toEqual([
        { mem_code: '0131', shop_name: 'ร้านขายยาโชคชัยเภสัช' },
      ]);
    });
  });

  describe('resolveShops', () => {
    it('คง mem_code ที่หาไม่เจอไว้ เพื่อให้แอดมินเห็นว่าร้านหายไปแล้ว', async () => {
      userRepo.find.mockResolvedValue([
        { mem_code: '0131', mem_nameSite: 'ร้านขายยาโชคชัยเภสัช' },
      ]);

      await expect(service.resolveShops(['0131', '9999'])).resolves.toEqual([
        { mem_code: '0131', shop_name: 'ร้านขายยาโชคชัยเภสัช' },
        { mem_code: '9999', shop_name: null },
      ]);
    });

    it('ไม่ยิง query เมื่อไม่มี mem_code', async () => {
      await expect(service.resolveShops([])).resolves.toEqual([]);
      expect(userRepo.find).not.toHaveBeenCalled();
    });
  });
});
