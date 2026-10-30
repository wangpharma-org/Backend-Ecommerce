import {
  isSlashFreeGiftName,
  notSlashFreeGiftSql,
  SLASH_FREE_SELLABLE_REGEXP,
  slashFreeGiftParams,
} from './free-gift-name.util';

describe('free-gift-name.util (ECWC-751)', () => {
  it.each([
    'ถุงยางวันทัช52มม/สตรอเบอรี่/ดำ/ฟรี1ชิ้น',
    'พยุงข้อมือ/ฟรีไซด์/ไทเกอร์315บ/',
    'พยุงข้อมือ/ฟูทูโร่/ครีม/ฟรีไซด/360บ',
    'กางเกงช้าง/ขาวดำ/ฟรีไซส์/ขายาว',
    'ยาดม/ฟรี 2 ชิ้น',
    'พาราเซตามอล500มก',
    null,
  ])('สินค้าขาย ไม่ใช่ของแถม: %s', (name) => {
    expect(isSlashFreeGiftName(name)).toBe(false);
  });

  it.each([
    'ทิชชู่/โซลแมค/ฟรี',
    'เกรพซีด60มก20แค็ป/วิสต้า/ฟรีเมื่อซื้อคอลลา2ข',
    'อมแก้ไอ/ฟรีซองเดี่ยว',
  ])('ของแถม: %s', (name) => {
    expect(isSlashFreeGiftName(name)).toBe(true);
  });

  it('SQL ใช้ pattern เดียวกับ JS', () => {
    expect(notSlashFreeGiftSql('p')).toBe(
      'NOT (p.pro_name LIKE :slashFree AND p.pro_name NOT REGEXP :slashFreeSellable)',
    );
    expect(slashFreeGiftParams()).toEqual({
      slashFree: '%/ฟรี%',
      slashFreeSellable: SLASH_FREE_SELLABLE_REGEXP,
    });
  });
});
