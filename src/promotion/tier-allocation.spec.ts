import { allocateTierSets, totalTierSets } from './tier-allocation';

describe('allocateTierSets', () => {
  const tier = (tier_id: number, threshold: number, is_unit = false) => ({
    tier_id,
    threshold,
    is_unit,
  });

  it('ยอดเป็นหลายเท่าของเกณฑ์ ได้ของแถมหลายชุด', () => {
    const sets = allocateTierSets([tier(1, 500)], { amount: 1590, units: 100 });
    expect(sets.get(1)).toBe(3);
    expect(totalTierSets(sets)).toBe(3);
  });

  it('ยังไม่ถึงเกณฑ์ ไม่ได้อะไรเลย', () => {
    const sets = allocateTierSets([tier(1, 500)], { amount: 499, units: 3 });
    expect(sets.get(1)).toBe(0);
  });

  it('ขั้นใหญ่กินยอดก่อน ที่เหลือค่อยตกไปขั้นเล็ก', () => {
    const sets = allocateTierSets([tier(1, 1000), tier(2, 2000)], {
      amount: 3000,
      units: 0,
    });
    expect(sets.get(2)).toBe(1);
    expect(sets.get(1)).toBe(1);
  });

  it('ยอดพอสำหรับขั้นใหญ่พอดี ขั้นเล็กไม่ได้ แม้ยอดรวมจะถึงเกณฑ์ของมัน', () => {
    const sets = allocateTierSets([tier(1, 1000), tier(2, 2000)], {
      amount: 2000,
      units: 0,
    });
    expect(sets.get(2)).toBe(1);
    expect(sets.get(1)).toBe(0);
  });

  it('ขั้นที่นับชิ้นใช้ถังจำนวนชิ้น ไม่ใช่ถังบาท', () => {
    const sets = allocateTierSets([tier(1, 10, true), tier(2, 500)], {
      amount: 500,
      units: 25,
    });
    expect(sets.get(1)).toBe(2);
    expect(sets.get(2)).toBe(1);
  });

  it('เกณฑ์ 0 หรือติดลบถูกข้าม ไม่แจกไม่จำกัด', () => {
    const sets = allocateTierSets([tier(1, 0), tier(2, -5)], {
      amount: 1000,
      units: 10,
    });
    expect(sets.get(1)).toBe(0);
    expect(sets.get(2)).toBe(0);
  });

  it('ไม่มีขั้นเลย = ไม่ได้อะไร', () => {
    expect(totalTierSets(allocateTierSets([], { amount: 9999, units: 9999 }))).toBe(0);
  });
});
