import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { HappyHourService } from './happy-hour.service';
import { HappyHourConfigEntity } from './happy-hour-config.entity';
import { HappyHourSlotEntity } from './happy-hour-slot.entity';
import { HappyHourSlotRewardEntity } from './happy-hour-slot-reward.entity';
import { HappyHourSlotLogEntity } from './happy-hour-slot-log.entity';
import { HappyHourConfigLogEntity } from './happy-hour-config-log.entity';
import { ProductEntity } from 'src/products/products.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';

/**
 * HappyHourService unit tests
 * - Mock TypeORM repositories อย่างน้อยที่จำเป็น
 * - แยกเป็น case: happy path / edge / bug-reproduction
 *   ดู BUG_REPORT.md
 */

// ใช้ Record<string, unknown> เพื่อให้ override ด้วย field ที่ entity ไม่มีได้ใน test
type SlotRow = Partial<HappyHourSlotEntity> & Record<string, unknown>;

const buildSlot = (overrides: SlotRow = {}): HappyHourSlotEntity => ({
  id: 1,
  start_time: '22:00:00',
  end_time: '24:00:00',
  min_order_amount: 9999 as unknown as number,
  card_value: 100 as unknown as number,
  excess_threshold: 1334 as unknown as number,
  discount_per_step: 10 as unknown as number,
  is_active: true,
  rewards: [],
  reward_amount: 1,
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
}) as HappyHourSlotEntity;

const createQbMock = (returnSlot: HappyHourSlotEntity | null, countValue = 0) => {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(returnSlot),
    getCount: jest.fn().mockResolvedValue(countValue),
  };
  return qb;
};

describe('HappyHourService', () => {
  let service: HappyHourService;
  let configRepo: any;
  let slotRepo: any;
  let rewardRepo: any;
  let adjustLogRepo: any;
  let slotLogRepo: any;
  let configLogRepo: any;
  let productRepo: any;
  let productUnitRepo: any;

  beforeEach(async () => {
    configRepo = {
      findOneBy: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
    };
    slotRepo = {
      count: jest.fn().mockResolvedValue(4),
      find: jest.fn(),
      findOne: jest.fn().mockResolvedValue(null),
      findOneBy: jest.fn(),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => (Array.isArray(x) ? x : { id: 1, ...x })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    };
    rewardRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    adjustLogRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      createQueryBuilder: jest.fn(),
    };
    slotLogRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      createQueryBuilder: jest.fn(),
    };
    configLogRepo = {
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => x),
      createQueryBuilder: jest.fn(),
    };
    productRepo = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    productUnitRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        HappyHourService,
        { provide: getRepositoryToken(HappyHourConfigEntity), useValue: configRepo },
        { provide: getRepositoryToken(HappyHourSlotEntity), useValue: slotRepo },
        { provide: getRepositoryToken(HappyHourSlotRewardEntity), useValue: rewardRepo },
        { provide: getRepositoryToken(HappyHourSlotLogEntity), useValue: slotLogRepo },
        { provide: getRepositoryToken(HappyHourConfigLogEntity), useValue: configLogRepo },
        { provide: getRepositoryToken(ProductEntity), useValue: productRepo },
        { provide: getRepositoryToken(ProductUnitEntity), useValue: productUnitRepo },
      ],
    }).compile();

    service = moduleRef.get(HappyHourService);
  });

  describe('onModuleInit (seeding)', () => {
    it('seeds DEFAULT_SLOTS when slot table empty', async () => {
      slotRepo.count.mockResolvedValueOnce(0);
      await service.onModuleInit();
      expect(slotRepo.create).toHaveBeenCalledTimes(4);
      expect(slotRepo.save).toHaveBeenCalledTimes(1);
      const savedArg = slotRepo.save.mock.calls[0][0];
      expect(savedArg).toHaveLength(4);
    });

    it('does not seed when slots already exist', async () => {
      slotRepo.count.mockResolvedValueOnce(4);
      await service.onModuleInit();
      expect(slotRepo.save).not.toHaveBeenCalled();
    });

    /**
     * BUG-002: ตรวจว่า DEFAULT_SLOTS มี end_time '24:00' (เลข 24 ผิดสำหรับ 24-hour clock)
     */
    it('BUG-002: default slots contain end_time "24:00" (non-canonical clock value)', async () => {
      slotRepo.count.mockResolvedValueOnce(0);
      await service.onModuleInit();
      const savedSlots = slotRepo.save.mock.calls[0][0] as SlotRow[];
      const has2400 = savedSlots.some((s) => s.end_time === '24:00');
      expect(has2400).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('returns existing config row', async () => {
      const config = { id: 1, is_enabled: true } as HappyHourConfigEntity;
      configRepo.findOneBy.mockResolvedValueOnce(config);
      const result = await service.getConfig();
      expect(result).toBe(config);
      expect(configRepo.save).not.toHaveBeenCalled();
    });

    it('creates default disabled config if none exists', async () => {
      configRepo.findOneBy.mockResolvedValueOnce(null);
      const result = await service.getConfig();
      expect(result.id).toBe(1);
      expect(result.is_enabled).toBe(false);
      expect(configRepo.save).toHaveBeenCalled();
    });
  });

  describe('toggle', () => {
    it('flips is_enabled from false to true and stamps user', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: false });
      const result = await service.toggle('admin1');
      expect(result.is_enabled).toBe(true);
      expect(result.updated_by).toBe('admin1');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('flips is_enabled from true to false', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const result = await service.toggle('admin2');
      expect(result.is_enabled).toBe(false);
    });
  });

  describe('getSlots', () => {
    it('returns slots ordered by start_time asc', async () => {
      const rows = [buildSlot({ id: 1 }), buildSlot({ id: 2 })];
      slotRepo.find.mockResolvedValueOnce(rows);
      const result = await service.getSlots();
      expect(slotRepo.find).toHaveBeenCalledWith({ order: { start_time: 'ASC' } });
      expect(result).toBe(rows);
    });
  });

  describe('createSlot', () => {
    const baseDto = {
      start_time: '10:00',
      end_time: '12:00',
      min_order_amount: 1000,
      card_value: 100,
      excess_threshold: 500,
      discount_per_step: 10,
    };

    it('creates slot when no overlap', async () => {
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null, 0));
      const saved = { id: 99, ...baseDto, is_active: true, rewards: [] };
      slotRepo.save.mockResolvedValueOnce(saved);
      slotRepo.findOne.mockResolvedValueOnce(saved);

      const result = await service.createSlot(baseDto as any, 'test-user');
      expect(result?.id).toBe(99);
      expect(slotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: true }),
      );
    });

    it('preserves is_active=false from dto', async () => {
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null, 0));
      slotRepo.save.mockResolvedValueOnce({ id: 1 });
      await service.createSlot({ ...baseDto, is_active: false } as any, 'test-user');
      expect(slotRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false }),
      );
    });

    it('throws BadRequest when start_time >= end_time', async () => {
      await expect(
        service.createSlot({ ...baseDto, start_time: '12:00', end_time: '12:00' } as any, 'test-user'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createSlot({ ...baseDto, start_time: '13:00', end_time: '10:00' } as any, 'test-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequest on overlap', async () => {
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null, 1));
      await expect(service.createSlot(baseDto as any, 'test-user')).rejects.toThrow(
        BadRequestException,
      );
    });

    /**
     * BUG-005 ครอบ boundary cases: 12:00-14:00 vs existing 10:00-12:00 ต้อง pass
     */
    it('allows adjacent (touching) slots — 12:00 boundary', async () => {
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null, 0));
      slotRepo.save.mockResolvedValueOnce({ id: 2 });
      await expect(
        service.createSlot({ ...baseDto, start_time: '12:00', end_time: '14:00' } as any, 'test-user'),
      ).resolves.toBeDefined();
    });
  });

  describe('updateSlot', () => {
    it('throws NotFound when slot id missing', async () => {
      slotRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.updateSlot(404, { is_active: false }, 'test-user')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('updates fields using existing time when not provided', async () => {
      const existing = buildSlot({ start_time: '10:00:00', end_time: '12:00:00' });
      slotRepo.findOneBy.mockResolvedValueOnce(existing);
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null, 0));
      slotRepo.save.mockImplementationOnce(async (s: any) => s);
      slotRepo.findOne.mockResolvedValueOnce({ ...existing, is_active: false, rewards: [] });

      const result = await service.updateSlot(1, { is_active: false }, 'test-user');
      expect(result?.is_active).toBe(false);
    });

    it('rejects partial update where new start_time >= existing end_time', async () => {
      const existing = buildSlot({ start_time: '10:00:00', end_time: '12:00:00' });
      slotRepo.findOneBy.mockResolvedValueOnce(existing);

      await expect(
        service.updateSlot(1, { start_time: '12:00' }, 'test-user'),
      ).rejects.toThrow(BadRequestException);
    });

    it('excludes self when checking overlap on update', async () => {
      const existing = buildSlot({ start_time: '10:00:00', end_time: '12:00:00' });
      slotRepo.findOneBy.mockResolvedValueOnce(existing);
      const qb = createQbMock(null, 0);
      slotRepo.createQueryBuilder.mockReturnValueOnce(qb);
      slotRepo.save.mockImplementationOnce(async (s: any) => s);

      await service.updateSlot(1, { start_time: '10:30', end_time: '11:30' }, 'test-user');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('slot.id != :excludeId'),
        { excludeId: 1 },
      );
    });
  });

  describe('deleteSlot', () => {
    it('throws NotFound when slot id missing', async () => {
      slotRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.deleteSlot(999, 'test-user')).rejects.toThrow(NotFoundException);
    });

    it('deletes existing slot', async () => {
      slotRepo.findOneBy.mockResolvedValueOnce(buildSlot({ id: 5 }));
      await service.deleteSlot(5, 'test-user');
      expect(slotRepo.delete).toHaveBeenCalledWith(5);
    });
  });

  describe('calcHappyHourReward', () => {
    it('returns null when config disabled', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: false });
      const result = await service.calcHappyHourReward(10000);
      expect(result).toBeNull();
    });

    it('returns null when no slot matches current time', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null));
      const result = await service.calcHappyHourReward(10000);
      expect(result).toBeNull();
    });

    it('returns null when orderAmount < min_order_amount (0 cards)', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const slot = buildSlot({
        min_order_amount: 9999 as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result = await service.calcHappyHourReward(5000);
      expect(result).toBeNull();
    });

    it('computes cards + zero excess', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result = await service.calcHappyHourReward(3000);
      expect(result).not.toBeNull();
      expect(result!.numCards).toBe(3);
      expect(result!.excessDiscount).toBe(0);
      expect(result!.totalCardValue).toBe(300);
    });

    it('computes cards + excess discount steps', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      // 3500 → 3 cards (3000), excess 500 → 1 step → 10 discount
      const result = await service.calcHappyHourReward(3500);
      expect(result).not.toBeNull();
      expect(result!.numCards).toBe(3);
      expect(result!.excessDiscount).toBe(10);
      expect(result!.totalCardValue).toBe(300);
    });

    /**
     * BUG-010: TypeORM decimal columns return strings; service must cast
     * test ใส่ค่า string เพื่อยืนยันว่า Number() cast ทำงานทุก field
     */
    it('BUG-010: handles decimal-as-string from DB', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const slot = buildSlot({
        min_order_amount: '1000.00' as unknown as number,
        card_value: '100.00' as unknown as number,
        excess_threshold: '500.00' as unknown as number,
        discount_per_step: '10.00' as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result = await service.calcHappyHourReward(2500);
      expect(result?.numCards).toBe(2);
      expect(result?.excessDiscount).toBe(10); // excess 500/500 = 1 step
      expect(result?.totalCardValue).toBe(200);
      expect(Number.isNaN(result?.totalCardValue)).toBe(false);
    });

    /**
     * BUG-003: shape mismatch — calc ไม่คืน totalReward; simulate คืน
     * Test นี้เพียง assert shape ปัจจุบันเพื่อ pin documentation ของ bug
     */
    it('BUG-003: return shape lacks total_reward (calc vs simulate divergence)', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: true });
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result = await service.calcHappyHourReward(2500);
      expect(result).not.toBeNull();
      expect(result).not.toHaveProperty('total_reward');
      expect(result).not.toHaveProperty('totalReward');
    });
  });

  describe('simulate', () => {
    const baseDto = { order_amount: 10000, order_time: '22:30' };

    it('returns is_happy_hour=false when no slot matches', async () => {
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(null));
      const result = await service.simulate(baseDto as any);
      expect(result).toEqual({ is_happy_hour: false, matched_slot: null });
    });

    it('returns is_happy_hour=false when orderAmount yields 0 cards', async () => {
      const slot = buildSlot({
        min_order_amount: '9999' as unknown as number,
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result = await service.simulate({
        order_amount: 100,
        order_time: '22:30',
      } as any);
      expect(result).toEqual({ is_happy_hour: false, matched_slot: null });
    });

    it('returns full reward_products array with product data (batch query)', async () => {
      const slot = buildSlot({
        id: 7,
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
        rewards: [{ id: 1, pro_code: 'P-X', unit: 'BOX' }] as any,
        reward_amount: 2,
      });

      // simulate ใช้ createQueryBuilder x2: slot query + product IN query
      const productQbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { pro_code: 'P-X', pro_name: 'ProductX', pro_imgmain: 'img.png' },
        ]),
      };
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));
      productRepo.createQueryBuilder.mockReturnValueOnce(productQbMock);

      const result: any = await service.simulate({
        order_amount: 3500,
        order_time: '22:30',
      } as any);

      expect(result.is_happy_hour).toBe(true);
      expect(result.num_cards).toBe(3);
      expect(result.excess_discount).toBe(10);
      expect(result.total_reward).toBe(310); // 3*100 + 10
      expect(result.reward_products).toHaveLength(1);
      expect(result.reward_products[0]).toMatchObject({
        pro_code: 'P-X',
        unit: 'BOX',
        amount: 6, // 3 cards * reward_amount=2
        pro_name: 'ProductX',
        pro_imgmain: 'img.png',
      });
    });

    it('returns null product fields when product not found in batch query', async () => {
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
        rewards: [{ id: 1, pro_code: 'MISSING', unit: null }] as any,
      });

      const productQbMock = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]), // product ไม่เจอ
      };
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));
      productRepo.createQueryBuilder.mockReturnValueOnce(productQbMock);

      const result: any = await service.simulate({
        order_amount: 2000,
        order_time: '22:30',
      } as any);
      expect(result.reward_products[0].pro_code).toBe('MISSING');
      expect(result.reward_products[0].pro_name).toBeNull();
      expect(result.reward_products[0].pro_imgmain).toBeNull();
    });

    it('returns empty reward_products when slot has no rewards', async () => {
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
        rewards: [],
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result: any = await service.simulate({
        order_amount: 2000,
        order_time: '22:30',
      } as any);
      expect(result.is_happy_hour).toBe(true);
      expect(result.reward_products).toEqual([]);
      // ไม่ควรเรียก productRepo เมื่อไม่มี rewards
      expect(productRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    /**
     * BUG-007: simulate ไม่เช็ค config.is_enabled
     * Test ยืนยัน behavior ปัจจุบัน (ทำงานได้แม้ feature ปิด)
     */
    it('BUG-007: works regardless of config.is_enabled (no guard)', async () => {
      configRepo.findOneBy.mockResolvedValueOnce({ id: 1, is_enabled: false });
      const slot = buildSlot({
        min_order_amount: '1000' as unknown as number,
        card_value: '100' as unknown as number,
        excess_threshold: '500' as unknown as number,
        discount_per_step: '10' as unknown as number,
        rewards: [],
      });
      slotRepo.createQueryBuilder.mockReturnValueOnce(createQbMock(slot));

      const result: any = await service.simulate({
        order_amount: 2000,
        order_time: '22:30',
      } as any);
      expect(result.is_happy_hour).toBe(true);
      // ไม่ได้แตะ configRepo.findOneBy เลย — ยืนยันว่า simulate ไม่ check config
      expect(configRepo.findOneBy).not.toHaveBeenCalled();
    });
  });
});
