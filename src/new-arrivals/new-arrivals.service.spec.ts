import { NewArrivalsService } from './new-arrivals.service';

/** queryRunner ปลอม: รายการที่มี LOT ใน `existing` ถือว่ารับเข้าแล้ว · save ใส่ id ให้ตามลำดับ */
const setup = (existing: string[] = []) => {
  let lastLot = '';
  let nextId = 100;
  const qb = {
    where: () => qb,
    andWhere: (sql: string, params: { LOT?: string }) => {
      if (params?.LOT !== undefined) lastLot = params.LOT;
      return qb;
    },
    setLock: () => qb,
    getOne: () => Promise.resolve(existing.includes(lastLot) ? {} : null),
  };
  const manager = {
    createQueryBuilder: () => qb,
    create: (_entity: unknown, data: object) => ({ ...data }),
    save: (rows: { id?: number }[]) => {
      rows.forEach((row) => (row.id = nextId++));
      return Promise.resolve(rows);
    },
  };
  const queryRunner = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };
  const repo = {
    manager: { connection: { createQueryRunner: () => queryRunner } },
  };
  const kafka = { emit: jest.fn() };
  const service = new NewArrivalsService(
    repo as never,
    {} as never,
    kafka as never,
    { upsertArrivedLots: jest.fn() } as never,
    { handleArrivals: jest.fn().mockResolvedValue(undefined) } as never,
  );
  return { service, kafka };
};

const item = (LOT: string) => ({
  pro_code: 'P001',
  LOT,
  MFG: '2026-09-01',
  EXP: '2028-08-31',
  createdAt: new Date('2026-10-29T03:00:00Z'),
  amount: 12,
  unit: 'กล่อง',
});

describe('NewArrivalsService.addNewArrival — newArrival_insert payload (SSN0-344)', () => {
  it('แต่ละรายการมี new_arrival_id + lot/mfg/exp เพิ่มจาก field เดิม', async () => {
    const { service, kafka } = setup();
    await service.addNewArrival([item('L1'), item('L2')]);
    expect(kafka.emit).toHaveBeenCalledTimes(1);
    const [topic, payload] = kafka.emit.mock.calls[0] as [
      string,
      { kafkaEvents: Record<string, unknown>[] },
    ];
    expect(topic).toBe('newArrival_insert');
    expect(payload.kafkaEvents).toEqual([
      expect.objectContaining({
        pro_code: 'P001',
        amount: 12,
        unit: 'กล่อง',
        new_arrival_id: 100,
        lot: 'L1',
        mfg: '2026-09-01',
        exp: '2028-08-31',
      }),
      expect.objectContaining({ new_arrival_id: 101, lot: 'L2' }),
    ]);
    // field เดิมที่ระบบจัดออเดอร์ใช้ยังอยู่ครบ
    expect(Object.keys(payload.kafkaEvents[0])).toEqual(
      expect.arrayContaining(['pro_code', 'createdAt', 'amount', 'unit']),
    );
  });

  it('รายการที่รับเข้าแล้ว (ซ้ำ) ไม่อยู่ใน event · id ตรงกับรายการที่บันทึกใหม่', async () => {
    const { service, kafka } = setup(['L1']);
    await service.addNewArrival([item('L1'), item('L2')]);
    const [, payload] = kafka.emit.mock.calls[0] as [
      string,
      {
        kafkaEvents: { lot: string; new_arrival_id: number }[];
      },
    ];
    expect(payload.kafkaEvents).toEqual([
      expect.objectContaining({ lot: 'L2', new_arrival_id: 100 }),
    ]);
  });
});
