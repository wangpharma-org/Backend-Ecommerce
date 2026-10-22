import {
  CHECKOUT_PREVIEW_MAX_LINES,
  parseCheckoutPreviewInput,
} from './checkout-preview.input';

describe('parseCheckoutPreviewInput', () => {
  it('ตัดช่องว่าง แปลงตัวเลข และใส่ redeem ว่างเมื่อไม่ส่ง', () => {
    expect(
      parseCheckoutPreviewInput({
        mem_code: ' 99001 ',
        lines: [{ pro_code: ' A ', unit: ' กล่อง ', qty: '2' }],
      }),
    ).toEqual({
      mem_code: '99001',
      lines: [{ pro_code: 'A', unit: 'กล่อง', qty: 2 }],
      redeem: [],
      price_option: undefined,
      mem_route: undefined,
    });
  });

  it('ไม่มีร้าน / lines ไม่ใช่ array / จำนวน ≤ 0 / redeem ไม่ใช่จำนวนเต็ม → null', () => {
    expect(parseCheckoutPreviewInput({ lines: [] })).toBeNull();
    expect(parseCheckoutPreviewInput({ mem_code: 'X', lines: 'A' })).toBeNull();
    expect(
      parseCheckoutPreviewInput({
        mem_code: 'X',
        lines: [{ pro_code: 'A', qty: 0 }],
      }),
    ).toBeNull();
    expect(
      parseCheckoutPreviewInput({
        mem_code: 'X',
        lines: [],
        redeem: [{ pro_code: 'R', amount: 1.5 }],
      }),
    ).toBeNull();
  });

  it('บรรทัดเกินเพดาน → null', () => {
    const lines = Array.from(
      { length: CHECKOUT_PREVIEW_MAX_LINES + 1 },
      () => ({ pro_code: 'A', unit: '1', qty: 1 }),
    );
    expect(parseCheckoutPreviewInput({ mem_code: 'X', lines })).toBeNull();
  });
});
