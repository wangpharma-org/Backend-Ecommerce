import {
  MAX_PART_BYTES,
  SaleReceivablesSyncService,
  planParts,
} from './sale-receivables-sync.service';

const post = jest.fn();
jest.mock('axios', () => {
  const actual = jest.requireActual<typeof import('axios')>('axios');
  return {
    __esModule: true,
    default: {
      post: (...args: unknown[]) => post(...args) as unknown,
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

// รูปเดียวกับ body ของ POST /ecom/reduct-invoice/add-invoice
const slip = (no: string, bills = 1) => ({
  invoice: no,
  mem_code: '00101',
  date: '2026-07-27',
  date_due: '2026-08-15',
  total: '8,668.30',
  payment: '0.00',
  balance: '8,668.30',
  bill_list: Array.from({ length: bills }, (_, i) => ({
    date: '2026-07-01',
    invoice: `5216-${70000 + i}`,
    price: '2,215.85',
    comments: `007-0${62000 + i}`,
  })),
});

describe('planParts', () => {
  it('ชุดว่าง = 1 ก้อนว่าง (ระบบขายล้างตาม)', () => {
    expect(planParts([])).toEqual({ parts: [[]], oversized: [] });
  });

  it('แบ่งตามขนาด JSON ทุกก้อน ≤ maxBytes และลำดับเดิม', () => {
    const items = Array.from({ length: 400 }, (_, i) => slip(`S${i}`, 3));
    const { parts, oversized } = planParts(items);
    expect(oversized).toEqual([]);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      expect(Buffer.byteLength(JSON.stringify(part))).toBeLessThanOrEqual(
        MAX_PART_BYTES,
      );
    }
    expect(parts.flat().map((s) => s.invoice)).toEqual(
      items.map((s) => s.invoice),
    );
  });

  it('แบ่งตามจำนวนด้วย', () => {
    const { parts } = planParts([1, 2, 3, 4, 5], 1000, 2);
    expect(parts).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('ใบเดียวใหญ่เกินก้อน = ข้าม ไม่ทำให้ใบอื่นตกหล่น', () => {
    const big = slip('BIG', 2000);
    const { parts, oversized } = planParts([slip('A'), big, slip('B')]);
    expect(oversized.map((s) => s.invoice)).toEqual(['BIG']);
    expect(parts.flat().map((s) => s.invoice)).toEqual(['A', 'B']);
  });
});

describe('SaleReceivablesSyncService.forward', () => {
  const service = new SaleReceivablesSyncService();
  const env = { ...process.env };

  beforeEach(() => {
    post.mockReset();
    process.env.SALE_RECEIVABLES_SYNC_ENABLED = 'true';
    process.env.WANG_MICROSERVICE_API = 'http://kafka-api:3025/';
  });
  afterAll(() => {
    process.env = env;
  });

  it('ปิดอยู่ = ไม่ส่ง', async () => {
    process.env.SALE_RECEIVABLES_SYNC_ENABLED = 'false';
    await expect(service.forward('billing_slip', [slip('A')])).resolves.toEqual(
      { status: 'disabled' },
    );
    expect(post).not.toHaveBeenCalled();
  });

  it('เปิดแต่ไม่ตั้ง WANG_MICROSERVICE_API = failed (ไม่เงียบ)', async () => {
    process.env.WANG_MICROSERVICE_API = '';
    await expect(
      service.forward('billing_slip', [slip('A')]),
    ).resolves.toMatchObject({ status: 'failed' });
    expect(post).not.toHaveBeenCalled();
  });

  it('ส่งทุกก้อนตามลำดับ importId/exportedAt เดียวกัน · endpoint ตามชนิด', async () => {
    post.mockResolvedValue({ status: 201 });
    const items = Array.from({ length: 400 }, (_, i) => slip(`S${i}`, 3));
    const result = await service.forward('billing_slip', items);

    expect(result).toMatchObject({ status: 'sent', skipped: 0 });
    const calls = post.mock.calls as [string, Record<string, unknown>][];
    expect(calls.length).toBe((result as { parts: number }).parts);
    expect(calls.length).toBeGreaterThan(1);
    calls.forEach(([url, body], index) => {
      expect(url).toBe(
        'http://kafka-api:3025/api/kafka/ecom-billing-slip-sync',
      );
      expect(body).toMatchObject({
        importId: calls[0][1].importId,
        exportedAt: calls[0][1].exportedAt,
        part: index + 1,
        parts: calls.length,
      });
    });
  });

  it('ใบลดหนี้ไป endpoint ของใบลดหนี้ · ชุดว่างส่ง 1 ก้อน', async () => {
    post.mockResolvedValue({ status: 201 });
    await service.forward('credit_note', []);
    expect(post).toHaveBeenCalledTimes(1);
    const [[url, body]] = post.mock.calls as [string, unknown][];
    expect(url).toBe('http://kafka-api:3025/api/kafka/ecom-credit-note-sync');
    expect(body).toMatchObject({
      part: 1,
      parts: 1,
      items: [],
    });
  });

  it('ก้อนแรกล้ม = หยุด ไม่ส่งก้อนที่เหลือ · ไม่ throw', async () => {
    post.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const items = Array.from({ length: 400 }, (_, i) => slip(`S${i}`, 3));
    await expect(service.forward('billing_slip', items)).resolves.toMatchObject(
      { status: 'failed', reason: 'ECONNREFUSED' },
    );
    expect(post).toHaveBeenCalledTimes(1);
  });
});
