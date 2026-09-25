import { unit1Of } from './preorder.service';
import { ProductEntity } from '../products/products.entity';

const prod = (units: { level: number; unit_name: string }[]) =>
  ({ units }) as unknown as ProductEntity;

describe('unit1Of (หน่วยเล็กสุดของสินค้า)', () => {
  it('เลือก level 1 เมื่อมี', () => {
    expect(
      unit1Of(
        prod([
          { level: 2, unit_name: 'กล่อง' },
          { level: 1, unit_name: 'แผง' },
        ]),
      ),
    ).toBe('แผง');
  });
  it('ไม่มี level 1 → ใช้ level ต่ำสุดที่มีชื่อหน่วย (เหมือนตะกร้า)', () => {
    expect(
      unit1Of(
        prod([
          { level: 3, unit_name: 'ลัง' },
          { level: 2, unit_name: 'กล่อง' },
        ]),
      ),
    ).toBe('กล่อง');
  });
  it('ข้ามหน่วยชื่อว่าง', () => {
    expect(
      unit1Of(
        prod([
          { level: 1, unit_name: ' ' },
          { level: 2, unit_name: 'กล่อง' },
        ]),
      ),
    ).toBe('กล่อง');
  });
  it('ไม่มีหน่วยเลย → null', () => {
    expect(unit1Of(prod([]))).toBeNull();
    expect(unit1Of(null)).toBeNull();
  });
});
