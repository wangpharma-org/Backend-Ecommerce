import { BadRequestException } from '@nestjs/common';
import {
  parseCustomerRequest,
  parseListQuery,
  parseStatusUpdate,
} from './stock-callback.validation';

describe('stock-callback validation (ECWC-766)', () => {
  describe('parseCustomerRequest', () => {
    it('รับสินค้า + หน่วย + จำนวนเต็มบวก (trim)', () => {
      expect(
        parseCustomerRequest({
          pro_code: ' 02010305 ',
          pro_unit: 'แอมป์',
          amount: '25',
        }),
      ).toEqual({ pro_code: '02010305', pro_unit: 'แอมป์', amount: 25 });
    });
    it('ไม่ส่งหน่วย → null', () => {
      expect(
        parseCustomerRequest({ pro_code: 'A', amount: 1 }).pro_unit,
      ).toBeNull();
    });
    it.each([
      [{ amount: 1 }],
      [{ pro_code: '', amount: 1 }],
      [{ pro_code: 'A', amount: 0 }],
      [{ pro_code: 'A', amount: -1 }],
      [{ pro_code: 'A', amount: 1.5 }],
      [{ pro_code: 'A', amount: '2a' }],
      [{ pro_code: 'A', amount: true }],
      [{ pro_code: 'A'.repeat(31), amount: 1 }],
      [null],
    ])('ปฏิเสธ %j', (body) => {
      expect(() => parseCustomerRequest(body)).toThrow(BadRequestException);
    });
  });

  describe('parseStatusUpdate', () => {
    it('รับสถานะที่รู้จัก + ผู้ดำเนินการ + note', () => {
      expect(
        parseStatusUpdate({
          status: 'contacted',
          emp_code: 'S001',
          emp_name: 'เซลส์ A',
          note: '  โทรแล้ว ',
        }),
      ).toEqual({
        status: 'contacted',
        emp_code: 'S001',
        emp_name: 'เซลส์ A',
        note: 'โทรแล้ว',
      });
    });
    it.each([
      [{ status: 'done', emp_code: 'S001' }],
      [{ status: 'toString', emp_code: 'S001' }],
      [{ status: 'closed' }],
      [{ status: 'closed', emp_code: 'S001', note: 5 }],
    ])('ปฏิเสธ %j', (body) => {
      expect(() => parseStatusUpdate(body)).toThrow(BadRequestException);
    });
  });

  describe('parseListQuery', () => {
    it('ค่าเริ่มต้น: ทุกสถานะ หน้า 1 ครั้งละ 50', () => {
      expect(parseListQuery({})).toEqual({
        status: null,
        q: null,
        page: 1,
        limit: 50,
      });
      expect(parseListQuery({ status: 'all' }).status).toBeNull();
    });
    it('รับ status/q/page/limit', () => {
      expect(
        parseListQuery({ status: 'open', q: ' ร้าน ', page: '2', limit: '20' }),
      ).toEqual({ status: 'open', q: 'ร้าน', page: 2, limit: 20 });
    });
    it.each([
      [{ status: 'x' }],
      [{ page: '0' }],
      [{ page: '2a' }],
      [{ limit: '201' }],
    ])('ปฏิเสธ %j', (q) => {
      expect(() => parseListQuery(q)).toThrow(BadRequestException);
    });
  });
});
