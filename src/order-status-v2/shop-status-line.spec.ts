import { PickingOrderDetailItem, toShopStatusLine } from './shop-status-line';

const item = (
  over: Partial<PickingOrderDetailItem> = {},
): PickingOrderDetailItem => ({
  pro_code: 'P001',
  product_name: 'ยา A',
  qty: 10,
  unit: 'กล่อง',
  price_unit: 50,
  price_total: 500,
  qc_price_total: 500,
  is_rt: false,
  ...over,
});

describe('toShopStatusLine (SSN0-367)', () => {
  it('ไม่ครบ → ได้/ขาดเป็นจำนวน', () => {
    const line = toShopStatusLine(
      item({
        qc_status: 'short',
        qc_qty: 6,
        qc_price_total: 300,
        qc_note: 'ของไม่พอ',
      }),
    );
    expect(line).toMatchObject({
      short: true,
      out_of_stock: false,
      received_qty: 6,
      missing_qty: 4,
      qc_note: 'ของไม่พอ',
    });
  });

  it('ไม่ครบ ในบิลที่ไม่มีราคา → ยังขึ้นว่าไม่ครบ', () => {
    const line = toShopStatusLine(
      item({
        price_unit: null,
        price_total: null,
        qc_price_total: null,
        qc_status: 'short',
        qc_qty: 2,
      }),
    );
    expect(line.short).toBe(true);
    expect(line.missing_qty).toBe(8);
  });

  it('ครบ → ขาด 0 ไม่ขึ้นธง', () => {
    const line = toShopStatusLine(item({ qc_status: 'complete', qc_qty: 10 }));
    expect(line).toMatchObject({
      short: false,
      received_qty: 10,
      missing_qty: 0,
    });
  });

  it('RT → ขาดทั้งรายการ ไม่ซ้อนธง short', () => {
    const line = toShopStatusLine(
      item({ is_rt: true, qc_status: 'rt', qc_qty: 0, qc_price_total: 0 }),
    );
    expect(line).toMatchObject({
      out_of_stock: true,
      short: false,
      received_qty: 0,
      missing_qty: 10,
    });
  });

  it('ยังไม่ตรวจนับ → ไม่มีตัวเลข', () => {
    const line = toShopStatusLine(item({ qc_status: 'pending', qc_qty: null }));
    expect(line).toMatchObject({
      short: false,
      received_qty: null,
      missing_qty: null,
    });
  });

  it('order-picking เวอร์ชันเก่า (ไม่มี qc_*) → ใช้ธงจากราคาแบบเดิม', () => {
    const line = toShopStatusLine(item({ qc_price_total: 300 }));
    expect(line).toMatchObject({
      short: true,
      received_qty: null,
      missing_qty: null,
      qc_note: null,
      changed_from: null,
    });
  });

  it('ส่งรหัสสินค้าเดิมเมื่อคลังเปลี่ยนสินค้า', () => {
    const line = toShopStatusLine(
      item({ qc_status: 'pending', change_from_procode: 'P000' }),
    );
    expect(line.changed_from).toBe('P000');
  });

  it('จำนวนเป็น string จาก decimal → แปลงเป็นตัวเลข', () => {
    const line = toShopStatusLine(
      item({
        qty: '12.00' as unknown as number,
        qc_status: 'short',
        qc_qty: '7.50' as unknown as number,
      }),
    );
    expect(line.qty).toBe(12);
    expect(line.received_qty).toBe(7.5);
    expect(line.missing_qty).toBe(4.5);
  });
});
