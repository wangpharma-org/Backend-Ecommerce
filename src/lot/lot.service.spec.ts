import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { LotService } from './lot.service';
import { LotEntity } from './lot.entity';

describe('LotService', () => {
  let service: LotService;
  let updateQb: {
    update: jest.Mock;
    set: jest.Mock;
    where: jest.Mock;
    andWhere: jest.Mock;
    execute: jest.Mock;
  };
  let manager: {
    createQueryBuilder: jest.Mock;
    upsert: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
  };
  const asManager = () => manager as unknown as EntityManager;
  const upsertedRows = () =>
    (manager.upsert.mock.calls[0] as [unknown, Partial<LotEntity>[]])[1];

  beforeEach(async () => {
    updateQb = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    manager = {
      createQueryBuilder: jest.fn().mockReturnValue(updateQb),
      upsert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue(undefined),
    };
    const lotRepo = {
      manager: {
        transaction: jest.fn((cb: (m: EntityManager) => unknown) =>
          cb(asManager()),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LotService,
        { provide: getRepositoryToken(LotEntity), useValue: lotRepo },
      ],
    }).compile();

    service = module.get(LotService);
  });

  describe('addLots', () => {
    it('สินค้า 1 ตัวเพิ่มได้หลาย lot', async () => {
      await service.addLots([
        { pro_code: 'P1', lot: 'A', mfg: '01/25', exp: '01/27' },
        { pro_code: 'P1', lot: 'B', mfg: '02/25', exp: '02/27' },
        { pro_code: 'P1', lot: 'C', mfg: '03/25', exp: '03/27' },
      ]);

      expect(upsertedRows().map((r) => r.lot)).toEqual(['A', 'B', 'C']);
      expect(upsertedRows().every((r) => r.is_active)).toBe(true);
      expect(manager.upsert).toHaveBeenCalledWith(
        LotEntity,
        expect.any(Array),
        { conflictPaths: ['product', 'lot', 'mfg', 'exp'] },
      );
    });

    it('ปิด lot ปัจจุบันของสินค้าก่อน upsert — lot ที่ไม่ได้ส่งมาจึงค้างเป็นประวัติ', async () => {
      await service.addLots([
        { pro_code: 'P1', lot: 'A', mfg: '01/25', exp: '01/27' },
        { pro_code: 'P2', lot: 'X', mfg: '01/25', exp: '01/27' },
      ]);

      expect(updateQb.set).toHaveBeenCalledWith({ is_active: false });
      expect(updateQb.where).toHaveBeenCalledWith(
        'pro_code IN (:...proCodes)',
        {
          proCodes: ['P1', 'P2'],
        },
      );
      expect(updateQb.execute.mock.invocationCallOrder[0]).toBeLessThan(
        manager.upsert.mock.invocationCallOrder[0],
      );
    });

    it('payload ว่างไม่แตะข้อมูล', async () => {
      await service.addLots([]);
      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(manager.upsert).not.toHaveBeenCalled();
    });
  });

  describe('upsertArrivedLots (new-arrivals)', () => {
    const receivedAt = new Date('2026-09-25T00:00:00Z');
    const queryCall = () => manager.query.mock.calls[0] as [string, unknown[]];

    it('insert lot พร้อม amount + received_at โดยไม่ปิด lot อื่น', async () => {
      await service.upsertArrivedLots(
        [
          {
            pro_code: 'P1',
            lot: 'B',
            mfg: '02/25',
            exp: '02/27',
            amount: 120,
            received_at: receivedAt,
          },
        ],
        asManager(),
      );

      expect(manager.createQueryBuilder).not.toHaveBeenCalled();
      expect(manager.upsert).not.toHaveBeenCalled();
      const [sql, params] = queryCall();
      expect(params).toEqual(['P1', 'B', '02/25', '02/27', 120, receivedAt]);
      // lot เดิมที่ active → บวก amount, lot ที่เป็นประวัติ → เริ่มนับใหม่
      // และต้องคำนวณ amount ก่อนตั้ง is_active = 1
      expect(sql).toMatch(
        /amount`\s*=\s*IF\(`is_active` = 1, COALESCE\(`amount`, 0\) \+ VALUES\(`amount`\), VALUES\(`amount`\)\)/,
      );
      expect(sql.indexOf('`amount` = IF')).toBeLessThan(
        sql.indexOf('`is_active` = 1'),
      );
    });

    it('ข้าม LOT ว่าง, trim ค่า และแปลง mfg/exp ที่ไม่มีค่าเป็นค่าว่าง', async () => {
      await service.upsertArrivedLots(
        [
          {
            pro_code: 'P1',
            lot: ' ',
            mfg: '',
            exp: '',
            amount: 1,
            received_at: receivedAt,
          },
          {
            pro_code: 'P1',
            lot: ' C ',
            mfg: undefined as unknown as string,
            exp: undefined as unknown as string,
            amount: 5,
            received_at: receivedAt,
          },
        ],
        asManager(),
      );

      expect(queryCall()[1]).toEqual(['P1', 'C', '', '', 5, receivedAt]);
    });

    it('ไม่มี lot ที่ใช้ได้เลย ไม่ยิง query', async () => {
      await service.upsertArrivedLots(
        [
          {
            pro_code: 'P1',
            lot: '',
            mfg: '',
            exp: '',
            amount: 1,
            received_at: receivedAt,
          },
        ],
        asManager(),
      );
      expect(manager.query).not.toHaveBeenCalled();
    });
  });
});
