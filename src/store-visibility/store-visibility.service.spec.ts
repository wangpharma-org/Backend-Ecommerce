import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerStoreVisibilityEntity } from './customer-store-visibility.entity';
import { CustomerStoreVisibilityLogEntity } from './customer-store-visibility-log.entity';
import {
  MAX_ASK_COUNT,
  StoreVisibilityLogContext,
  StoreVisibilityService,
} from './store-visibility.service';
import { CONSENT_VERSION, consentTextHash } from './store-visibility.consent';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const MEM_CODE = 'M0001';

const CONTEXT: StoreVisibilityLogContext = {
  channel: 'WEB',
  ip: '10.0.0.1',
  user_agent: 'jest',
};

describe('StoreVisibilityService', () => {
  let service: StoreVisibilityService;
  let manager: {
    findOne: jest.Mock;
    upsert: jest.Mock;
    insert: jest.Mock;
    transaction: jest.Mock;
  };
  let visibilityRepo: { findOne: jest.Mock; find: jest.Mock; manager: unknown };
  let featureFlags: { getFlag: jest.Mock };

  // แถวที่ "มีอยู่แล้ว" ในตาราง — null = ยังไม่เคยมีแถว
  const givenRow = (
    row: Partial<CustomerStoreVisibilityEntity> | null,
  ): void => {
    manager.findOne.mockResolvedValue(row);
  };

  const logRows = () =>
    manager.insert.mock.calls.map(
      ([, values]) => values as Record<string, unknown>,
    );

  beforeEach(async () => {
    manager = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue(undefined),
      insert: jest.fn().mockResolvedValue(undefined),
      // transaction ของ TypeORM ส่ง EntityManager ให้ callback — ในเทสต์ส่งตัว mock เดิมกลับไป
      transaction: jest.fn((cb: (m: unknown) => unknown): unknown =>
        cb(manager),
      ),
    };
    visibilityRepo = { findOne: jest.fn(), find: jest.fn(), manager };
    featureFlags = { getFlag: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StoreVisibilityService,
        {
          provide: getRepositoryToken(CustomerStoreVisibilityEntity),
          useValue: visibilityRepo,
        },
        { provide: FeatureFlagsService, useValue: featureFlags },
      ],
    }).compile();

    service = module.get(StoreVisibilityService);
  });

  describe('getSetting', () => {
    it('ไม่มีแถว = ยังไม่ถูกถาม ยังไม่ยินยอม และควรถาม', async () => {
      visibilityRepo.findOne.mockResolvedValue(null);
      const setting = await service.getSetting(MEM_CODE);
      expect(setting).toMatchObject({
        status: 'NOT_ASKED',
        show_store_name: false,
        should_ask: true,
        asked_count: 0,
      });
      expect(setting.consent.version).toBe(CONSENT_VERSION);
    });

    it('ยินยอมไว้กับข้อความเวอร์ชันเก่า ไม่นับว่ายินยอม', async () => {
      visibilityRepo.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        status: 'GRANTED',
        consent_version: CONSENT_VERSION - 1,
        asked_count: 0,
      });
      expect(await service.getSetting(MEM_CODE)).toMatchObject({
        status: 'GRANTED',
        show_store_name: false,
        should_ask: true,
      });
    });

    it('ปฏิเสธแล้วไม่ถามซ้ำ', async () => {
      visibilityRepo.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        status: 'DECLINED',
        consent_version: null,
        asked_count: 1,
      });
      expect(await service.getSetting(MEM_CODE)).toMatchObject({
        should_ask: false,
      });
    });
  });

  describe('setSetting', () => {
    it('ยังไม่เคยถูกถาม → เปิด = GRANTED และ log พร้อมหลักฐาน', async () => {
      givenRow(null);
      const setting = await service.setSetting(MEM_CODE, true, CONTEXT);

      expect(setting).toMatchObject({
        status: 'GRANTED',
        show_store_name: true,
        should_ask: false,
      });
      expect(manager.upsert).toHaveBeenCalledWith(
        CustomerStoreVisibilityEntity,
        {
          mem_code: MEM_CODE,
          status: 'GRANTED',
          consent_version: CONSENT_VERSION,
          asked_count: 0,
        },
        ['mem_code'],
      );
      expect(manager.insert).toHaveBeenCalledWith(
        CustomerStoreVisibilityLogEntity,
        {
          mem_code: MEM_CODE,
          action: 'GRANTED',
          consent_version: CONSENT_VERSION,
          text_hash: consentTextHash(),
          channel: 'WEB',
          ip: '10.0.0.1',
          user_agent: 'jest',
        },
      );
    });

    it('ยังไม่เคยถูกถาม → ปิด = DECLINED (ไม่ใช่ WITHDRAWN)', async () => {
      givenRow(null);
      const setting = await service.setSetting(MEM_CODE, false, CONTEXT);

      expect(setting.status).toBe('DECLINED');
      expect(logRows()).toEqual([
        expect.objectContaining({ action: 'DECLINED' }),
      ]);
    });

    it('เคยเปิดไว้ → ปิด = WITHDRAWN', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'GRANTED',
        consent_version: CONSENT_VERSION,
        asked_count: 0,
      });
      const setting = await service.setSetting(MEM_CODE, false, CONTEXT);

      expect(setting).toMatchObject({
        status: 'DECLINED',
        show_store_name: false,
      });
      expect(logRows()).toEqual([
        expect.objectContaining({ action: 'WITHDRAWN' }),
      ]);
    });

    it('ปิดซ้ำไม่เขียนทั้งสถานะและ log', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'DECLINED',
        consent_version: null,
        asked_count: 2,
      });
      const setting = await service.setSetting(MEM_CODE, false, CONTEXT);

      expect(setting).toMatchObject({ status: 'DECLINED', asked_count: 2 });
      expect(manager.upsert).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('เปิดซ้ำในเวอร์ชันข้อความเดิมไม่เขียนทั้งสถานะและ log', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'GRANTED',
        consent_version: CONSENT_VERSION,
        asked_count: 0,
      });
      await service.setSetting(MEM_CODE, true, CONTEXT);

      expect(manager.upsert).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('เคยยินยอมไว้กับข้อความเวอร์ชันเก่า เปิดใหม่ = ยินยอมครั้งใหม่ ต้อง log', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'GRANTED',
        consent_version: CONSENT_VERSION - 1,
        asked_count: 0,
      });
      await service.setSetting(MEM_CODE, true, CONTEXT);

      expect(logRows()).toEqual([
        expect.objectContaining({
          action: 'GRANTED',
          consent_version: CONSENT_VERSION,
        }),
      ]);
    });

    it('จำนวนครั้งที่เคยถามไม่ถูกรีเซ็ตตอนตั้งค่า', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'NOT_ASKED',
        consent_version: null,
        asked_count: 2,
      });
      await service.setSetting(MEM_CODE, true, CONTEXT);

      expect(manager.upsert).toHaveBeenCalledWith(
        CustomerStoreVisibilityEntity,
        expect.objectContaining({ asked_count: 2 }),
        ['mem_code'],
      );
    });
  });

  describe('markAsked', () => {
    it('นับเพิ่มทีละครั้งและ log action ASKED', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'NOT_ASKED',
        consent_version: null,
        asked_count: 1,
      });
      const setting = await service.markAsked(MEM_CODE, CONTEXT);

      expect(setting).toMatchObject({ asked_count: 2, should_ask: true });
      expect(logRows()).toEqual([expect.objectContaining({ action: 'ASKED' })]);
    });

    it(`ถามครบ ${MAX_ASK_COUNT} ครั้งแล้ว should_ask = false และไม่นับเพิ่ม`, async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'NOT_ASKED',
        consent_version: null,
        asked_count: MAX_ASK_COUNT,
      });
      const setting = await service.markAsked(MEM_CODE, CONTEXT);

      expect(setting).toMatchObject({
        asked_count: MAX_ASK_COUNT,
        should_ask: false,
      });
      expect(manager.upsert).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });

    it('ครั้งที่ทำให้ครบเพดานยังนับได้ แต่หลังจากนั้นไม่ถามอีก', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'NOT_ASKED',
        consent_version: null,
        asked_count: MAX_ASK_COUNT - 1,
      });
      const setting = await service.markAsked(MEM_CODE, CONTEXT);

      expect(setting).toMatchObject({
        asked_count: MAX_ASK_COUNT,
        should_ask: false,
      });
      expect(manager.insert).toHaveBeenCalled();
    });

    it('ตอบไปแล้ว (ปฏิเสธ) ไม่นับเพิ่มและไม่ log', async () => {
      givenRow({
        mem_code: MEM_CODE,
        status: 'DECLINED',
        consent_version: null,
        asked_count: 0,
      });
      await service.markAsked(MEM_CODE, CONTEXT);

      expect(manager.upsert).not.toHaveBeenCalled();
      expect(manager.insert).not.toHaveBeenCalled();
    });
  });

  describe('findVisibleMemCodes', () => {
    it('ไม่ยิง query เมื่อไม่มี mem_code', async () => {
      expect(await service.findVisibleMemCodes([])).toEqual(new Set());
      expect(visibilityRepo.find).not.toHaveBeenCalled();
    });

    it('นับเฉพาะ GRANTED ที่ผูกกับข้อความเวอร์ชันปัจจุบัน', async () => {
      visibilityRepo.find.mockResolvedValue([{ mem_code: MEM_CODE }]);
      const visible = await service.findVisibleMemCodes([MEM_CODE, 'M0002']);

      expect(visible).toEqual(new Set([MEM_CODE]));
      // expect.objectContaining คืน any — พักไว้ใน unknown ก่อนเพื่อไม่ให้ชน no-unsafe-assignment
      const whereMatcher: unknown = expect.objectContaining({
        status: 'GRANTED',
        consent_version: CONSENT_VERSION,
      });
      expect(visibilityRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: whereMatcher }),
      );
    });
  });

  describe('flag store_name_consent ปิด', () => {
    beforeEach(() => featureFlags.getFlag.mockResolvedValue(false));

    it('getSetting ไม่ถาม และไม่ถือว่ายินยอมแม้มีแถว GRANTED', async () => {
      visibilityRepo.findOne.mockResolvedValue({
        mem_code: MEM_CODE,
        status: 'GRANTED',
        consent_version: CONSENT_VERSION,
        asked_count: 0,
      });
      expect(await service.getSetting(MEM_CODE)).toMatchObject({
        enabled: false,
        show_store_name: false,
        should_ask: false,
      });
    });

    it('setSetting / markAsked ตอบ 403 และไม่เขียนอะไรลง DB', async () => {
      await expect(service.setSetting(MEM_CODE, true, CONTEXT)).rejects.toThrow(
        'ยังไม่เปิดใช้งาน',
      );
      await expect(service.markAsked(MEM_CODE, CONTEXT)).rejects.toThrow(
        'ยังไม่เปิดใช้งาน',
      );
      expect(manager.transaction).not.toHaveBeenCalled();
    });

    it('findVisibleMemCodes ไม่คืนร้านไหนเลย', async () => {
      expect(await service.findVisibleMemCodes([MEM_CODE])).toEqual(new Set());
      expect(visibilityRepo.find).not.toHaveBeenCalled();
    });
  });
});
