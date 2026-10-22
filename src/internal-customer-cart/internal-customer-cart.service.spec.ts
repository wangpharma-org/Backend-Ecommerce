import { DataSource } from 'typeorm';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { InternalCustomerCartService } from './internal-customer-cart.service';

const month = new Date(Date.now() + 7 * 3600e3).getUTCMonth() + 1;
const row = (over: Record<string, unknown>) => ({
  pro_code: 'P1',
  pro_name: 'ยา 1',
  unit_name: 'กล่อง',
  ratio: 10,
  spc_unit_enum: '2',
  spc_amount: '2',
  spc_datetime: '2026-10-10T03:00:00.000Z',
  spc_checked: 1,
  pro_priceA: '5',
  pro_priceB: '6',
  pro_priceC: '7',
  pro_promotion_month: null,
  pro_promotion_amount: null,
  flash: 0,
  hotdeal: 0,
  ...over,
});

const make = (priceOption: string | null, rows: unknown[]) => {
  const query = jest
    .fn()
    .mockResolvedValueOnce(
      priceOption === null ? [] : [{ mem_price: priceOption }],
    )
    .mockResolvedValueOnce(rows);
  return {
    service: new InternalCustomerCartService(
      { query } as unknown as DataSource,
      {} as ShoppingCartService,
    ),
    query,
  };
};

describe('InternalCustomerCartService', () => {
  it('ใช้ราคาตามระดับร้าน × ratio ของหน่วย และไม่ส่งของแถม (SQL กรอง is_reward/hotdeal_free)', async () => {
    const { service, query } = make('B', [row({})]);
    const cart = await service.getCart('M1');
    expect(cart.price_option).toBe('B');
    expect(cart.lines[0]).toMatchObject({
      unit: 'กล่อง',
      qty: 2,
      unit_price: 60,
      line_total: 120,
    });
    expect(String(query.mock.calls[1][0])).toMatch(
      /is_reward = 0 AND c\.hotdeal_free = 0/,
    );
  });

  it('ถึงขั้นโปรเดือน → ราคา A · ยังไม่ถึง → ราคาระดับร้าน', async () => {
    const reached = make('C', [
      row({ pro_promotion_month: month, pro_promotion_amount: 20 }),
    ]);
    expect((await reached.service.getCart('M1')).lines[0]).toMatchObject({
      unit_price: 50,
      promo: { monthly: true },
    });
    const short = make('C', [
      row({ pro_promotion_month: month, pro_promotion_amount: 21 }),
    ]);
    expect((await short.service.getCart('M1')).lines[0].unit_price).toBe(70);
  });

  it('ร้านไม่มีระดับราคา → ราคา C · ธง flash/hotdeal', async () => {
    const { service } = make(null, [
      row({ ratio: null, spc_unit_enum: null, flash: 1, hotdeal: 2 }),
    ]);
    const line = (await service.getCart('M1')).lines[0];
    expect(line).toMatchObject({
      unit_level: 1,
      unit_price: 7,
      promo: { flash_sale: true, hot_deal: true },
    });
  });
});
