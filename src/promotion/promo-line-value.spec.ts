import { lineDiscountPercent } from './promo-line-value';

/**
 * ส่วนลดต่อบรรทัดที่ส่งไปให้ระบบบิล (ECWC-567)
 * ตัวเลขในเทสมาจากกระเช้าทดสอบจริง SET-DEMO-03 ราคาชุด 139 จากของ 150
 */
describe('lineDiscountPercent', () => {
  it('ขายราคาปกติ = ไม่มีส่วนลด', () => {
    expect(lineDiscountPercent(2385, 2385)).toBe(0);
  });

  it('ของแถม = ลด 100% แต่ยังบอกมูลค่าปกติได้', () => {
    expect(lineDiscountPercent(80, 0)).toBe(100);
  });

  it('กระเช้าสำเร็จรูป คิดจากราคาปกติเทียบยอดที่เก็บจริง', () => {
    // น้ำมันมวย 3 ขวด ปกติ 75.00 เก็บจริง 69.50
    expect(lineDiscountPercent(75, 69.5)).toBe(7.33);
    // มูโคเฟล็กซ์ 2 ขวด ปกติ 50.00 เก็บจริง 46.33
    expect(lineDiscountPercent(50, 46.33)).toBe(7.34);
    // พลาสเตอร์ 1 กล ปกติ 25.00 เก็บจริง 23.17
    expect(lineDiscountPercent(25, 23.17)).toBe(7.32);
  });

  it('สินค้าราคา 0 ไม่ถูกตีเป็นส่วนลด 100% (ของเดิมปลายทางเดาผิดตรงนี้)', () => {
    expect(lineDiscountPercent(0, 0)).toBe(0);
  });

  it('กันค่าเพี้ยน — ไม่ติดลบและไม่เกิน 100', () => {
    expect(lineDiscountPercent(100, 120)).toBe(0);
    expect(lineDiscountPercent(100, -5)).toBe(100);
  });
});
