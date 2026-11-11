import { ConfigService } from '@nestjs/config';
import { of } from 'rxjs';
import { OrderStatusV2Service } from './order-status-v2.service';

// SSN0-397 getShopStatusDetails — สถานะ + รายการของหลายบิลหลายร้าน (หน้า "สถานะออเดอร์" รวมทุกร้านของระบบขาย)
// order-picking / logistics / DB ถูกแทนด้วยของปลอม — ทดสอบการประกอบบิลแบบเดียวกับ getShopStatusTable

type Head = { soh_running: string; soh_datetime: Date; soh_sumprice: number };
const HEADS: Record<string, Head[]> = {
  SHOPA: [
    { soh_running: 'A1', soh_datetime: new Date('2026-11-10T03:00:00Z'), soh_sumprice: 300 },
    { soh_running: 'A2', soh_datetime: new Date('2026-11-10T05:00:00Z'), soh_sumprice: 50 },
  ],
};

const headRepo = (calls: { mem: string; runs: string[] }[]) => ({
  createQueryBuilder: () => {
    const params: { mem?: string; runs?: string[] } = {};
    const qb = {
      where: (_: string, p: { mem: string }) => ((params.mem = p.mem), qb),
      andWhere: (_: string, p: { runs: string[] }) => ((params.runs = p.runs), qb),
      select: () => qb,
      getMany: () => {
        calls.push({ mem: params.mem!, runs: params.runs! });
        return Promise.resolve(
          (HEADS[params.mem!] ?? []).filter((h) => params.runs!.includes(h.soh_running)),
        );
      },
    };
    return qb;
  },
});

// รายการตอนสั่งของ ecommerce (บิลที่ยังไม่ถึงคลัง)
const orderRepo = {
  createQueryBuilder: () => {
    const qb = {
      leftJoin: () => qb,
      where: () => qb,
      select: () => qb,
      getMany: () =>
        Promise.resolve([
          {
            orderHeader: { soh_running: 'A2' },
            pro_code: 'P9',
            product: { pro_code: 'P9', pro_name: 'ยาตอนสั่ง' },
            spo_qty: '2',
            spo_unit: 'กล่อง',
            spo_price_unit: '25',
            spo_total_decimal: '50',
          },
        ]),
    };
    return qb;
  },
};

const http = {
  post: (url: string, body: { sh_running: string[]; mem_code: string }) => {
    if (url.endsWith('/order-status/details-batch')) {
      const items: unknown[] = [];
      if (body.mem_code === 'SHOPA' && body.sh_running.includes('A1'))
        items.push({
          sh_running: 'A1',
          sh_datetime: '2026-11-10T03:00:00Z',
          status: 'ready',
          items: [
            { pro_code: 'P1', product_name: 'ยา 1', qty: 1, unit: 'ขวด', price_unit: 100, price_total: 100, qc_price_total: 0, is_rt: true },
            { pro_code: 'P2', product_name: 'ยา 2', qty: 2, unit: 'ขวด', price_unit: 100, price_total: 200, qc_price_total: 100, is_rt: false },
          ],
        });
      if (body.mem_code === 'SHOPB' && body.sh_running.includes('B1'))
        items.push({
          sh_running: 'B1',
          sh_datetime: '2026-11-10T08:00:00Z',
          status: 'checking',
          items: [{ pro_code: 'P3', product_name: 'ยา 3', qty: 1, unit: 'ขวด', price_unit: 40, price_total: 40, qc_price_total: 40, is_rt: false }],
        });
      return of({ data: items });
    }
    if (url.endsWith('/order-status/batch')) return of({ data: {} });
    if (url.endsWith('/tracking/batch-by-bill'))
      return of({ data: body.mem_code === 'SHOPA' ? { A1: 'DELIVERING' } : {} });
    throw new Error(`unexpected POST ${url}`);
  },
  get: (url: string) => {
    if (url.includes('/order-status/A1')) return of({ data: { bill_number: 'INV-A1' } });
    throw new Error(`unexpected GET ${url}`);
  },
};

const createService = (calls: { mem: string; runs: string[] }[]) =>
  new OrderStatusV2Service(
    headRepo(calls) as never,
    orderRepo as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    http as never,
    { get: () => undefined } as unknown as ConfigService,
  );

describe('OrderStatusV2Service.getShopStatusDetails (SSN0-397)', () => {
  it('builds every requested bill across shops, newest first, with mem_code', async () => {
    const calls: { mem: string; runs: string[] }[] = [];
    const res = await createService(calls).getShopStatusDetails([
      { sh_running: 'A1', mem_code: 'SHOPA' },
      { sh_running: 'A2', mem_code: 'SHOPA' },
      { sh_running: 'B1', mem_code: 'SHOPB' },
    ]);
    expect(res.partial).toBe(false);
    expect(res.labels.delivering).toBeTruthy();
    expect(res.orders.map((o) => `${o.mem_code}/${o.soh_running}`)).toEqual([
      'SHOPB/B1',
      'SHOPA/A2',
      'SHOPA/A1',
    ]);
    expect(calls.map((c) => c.mem).sort()).toEqual(['SHOPA', 'SHOPB']);
  });

  it('picking lines carry out-of-stock / short flags, status and bill number', async () => {
    const res = await createService([]).getShopStatusDetails([
      { sh_running: 'A1', mem_code: 'SHOPA' },
    ]);
    const a1 = res.orders[0];
    expect(a1.source).toBe('ecommerce');
    expect(a1.status).toBe('delivering');
    expect(a1.bill_number).toBe('INV-A1');
    expect(a1.sumprice).toBe(300);
    expect(a1.out_of_stock_count).toBe(1);
    expect(a1.lines.map((l) => [l.pro_code, l.out_of_stock, l.short])).toEqual([
      ['P1', true, false],
      ['P2', false, true],
    ]);
  });

  it('bill not yet at the warehouse uses the e-commerce lines and stays "opened"', async () => {
    const res = await createService([]).getShopStatusDetails([
      { sh_running: 'A2', mem_code: 'SHOPA' },
    ]);
    expect(res.orders[0]).toMatchObject({
      status: 'opened',
      source: 'ecommerce',
      item_count: 1,
      lines: [{ pro_code: 'P9', qty: 2, price_total: 50 }],
    });
  });

  it('bill only in order-picking (keyed in the sale system) takes its time from the warehouse', async () => {
    const res = await createService([]).getShopStatusDetails([
      { sh_running: 'B1', mem_code: 'SHOPB' },
    ]);
    expect(res.orders[0]).toMatchObject({
      source: 'order_picking',
      status: 'checking',
      soh_datetime: '2026-11-10T08:00:00.000Z',
      sumprice: 40,
    });
  });

  it('drops bad items, dedupes, and caps at 200 bills', async () => {
    const calls: { mem: string; runs: string[] }[] = [];
    const many = Array.from({ length: 250 }, (_, i) => ({
      sh_running: `X${i}`,
      mem_code: 'SHOPX',
    }));
    const res = await createService(calls).getShopStatusDetails([
      { sh_running: '', mem_code: 'SHOPA' },
      { sh_running: 'A1', mem_code: '' },
      { sh_running: 'x'.repeat(41), mem_code: 'SHOPA' },
      { sh_running: 7 as unknown as string, mem_code: 'SHOPA' },
      ...many,
    ]);
    // 4 รายการเสียนับรวมใน 200 แรก → เหลือ X0–X195
    expect(calls).toEqual([{ mem: 'SHOPX', runs: many.slice(0, 196).map((m) => m.sh_running) }]);
    expect(res.orders).toHaveLength(196);
  });

  it('empty / non-array input returns no orders without calling anything', async () => {
    const calls: { mem: string; runs: string[] }[] = [];
    const service = createService(calls);
    expect((await service.getShopStatusDetails([])).orders).toEqual([]);
    expect((await service.getShopStatusDetails(null as never)).orders).toEqual([]);
    expect(calls).toEqual([]);
  });
});
