import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { OrderStatusV2Service } from './order-status-v2.service';

// สถานะต่อใบให้ระบบขาย: ขั้นละเอียดในคลังจาก order-picking stage-batch + fallback ไป batch เดิม
type Responses = Record<string, unknown>;

const createService = (responses: Responses) => {
  const post = jest.fn((url: string) => {
    const key = Object.keys(responses).find((k) => url.endsWith(k));
    const res = key ? responses[key] : new Error(`no mock for ${url}`);
    return res instanceof Error ? throwError(() => res) : of({ data: res });
  });
  const service = new OrderStatusV2Service(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { post } as never,
    { get: () => undefined } as unknown as ConfigService,
  );
  return { service, post };
};

describe('OrderStatusV2Service.getShopStatusBatch', () => {
  it('ส่งขั้นละเอียดในคลังให้ระบบขาย และสถานะชุดเดิมยังตรงกับหน้าลูกค้า', async () => {
    const { service, post } = createService({
      '/api/ecom/order-status/stage-batch': {
        A: 'waiting_pick',
        B: 'picking',
        C: 'picked',
        D: 'qc',
        E: 'ready',
        F: 'ready',
        G: 'blocked',
      },
      '/api/logistic/tracking/batch-by-bill': { F: 'DELIVERING' },
    });
    const out = await service.getShopStatusBatch(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((r) => ({
        sh_running: r,
        mem_code: 'M1',
      })),
    );
    const by = Object.fromEntries(out.map((o) => [o.sh_running, o]));
    expect(by.A).toMatchObject({
      status: 'picking',
      picking_stage: 'waiting_pick',
    });
    expect(by.B).toMatchObject({ status: 'picking', picking_stage: 'picking' });
    expect(by.C).toMatchObject({ status: 'checking', picking_stage: 'picked' });
    expect(by.D).toMatchObject({ status: 'checking', picking_stage: 'qc' });
    expect(by.E).toMatchObject({
      status: 'waiting_load',
      picking_stage: 'ready',
    });
    // ถึงมือขนส่งแล้ว = ไม่ส่งขั้นในคลัง
    expect(by.F).toMatchObject({ status: 'delivering', picking_stage: null });
    expect(by.G).toMatchObject({ status: 'blocked', picking_stage: null });
    expect(by.H).toMatchObject({ status: 'opened', picking_stage: null });
    // ไม่เรียก batch เดิมเมื่อ stage-batch ตอบได้
    expect(
      post.mock.calls.some(([url]) =>
        String(url).endsWith('/api/ecom/order-status/batch'),
      ),
    ).toBe(false);
  });

  it('order-picking ยังไม่มี stage-batch (404) → ใช้ batch เดิม ไม่มีขั้นละเอียด', async () => {
    const { service } = createService({
      '/api/ecom/order-status/stage-batch': new Error('404'),
      '/api/ecom/order-status/batch': { A: 'picking', B: 'ready' },
      '/api/logistic/tracking/batch-by-bill': {},
    });
    const out = await service.getShopStatusBatch([
      { sh_running: 'A', mem_code: 'M1' },
      { sh_running: 'B', mem_code: 'M1' },
    ]);
    expect(out).toEqual([
      expect.objectContaining({
        sh_running: 'A',
        status: 'picking',
        picking_stage: null,
      }),
      expect.objectContaining({
        sh_running: 'B',
        status: 'waiting_load',
        picking_stage: null,
      }),
    ]);
  });
});
