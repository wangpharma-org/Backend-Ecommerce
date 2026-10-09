import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import {
  CustomerReturnService,
  completedMessage,
} from './customer-return.service';
import { CreateReturnDto } from './customer-return.dto';

const BUCKET = 'wang-storage';

const makeService = () => {
  const client = { get: jest.fn(), post: jest.fn().mockResolvedValue({}) };
  const http = { post: jest.fn().mockReturnValue(of({ data: {} })) };
  const userRepo = {
    findOne: jest.fn().mockResolvedValue({
      mem_nameSite: 'ร้านยาทดสอบ',
      mem_address: '12/3',
      mem_tumbon: 'ในเมือง',
      mem_amphur: 'เมือง',
      mem_province: 'ขอนแก่น',
      mem_post: '40000',
    }),
  };
  const service = new CustomerReturnService(
    client as never,
    http as never,
    userRepo as never,
  );
  return { service, client, http, userRepo };
};

const dtoWithPhoto = (url: string): CreateReturnDto => ({
  sh_running: 'SH001',
  pickup_date: '2026-10-12',
  pickup_slot: '09:00-12:00',
  items: [
    {
      pro_code: 'A1',
      qty_return: 1,
      reason: 'damaged',
      customer_photos: [url],
    },
  ],
});

describe('CustomerReturnService', () => {
  const ownUrl = `https://${BUCKET}.sgp1.digitaloceanspaces.com/customer-return/photos/10075/1-ab.jpg`;

  it('create ส่ง mem_code จาก JWT + ชื่อร้าน/ที่อยู่จากตาราง users ไป Order Picking', async () => {
    const { service, client } = makeService();
    await service.create('10075', dtoWithPhoto(ownUrl));
    expect(client.post).toHaveBeenCalledWith(
      'ecom/requests',
      expect.objectContaining({
        mem_code: '10075',
        customer_name: 'ร้านยาทดสอบ',
        pickup_address: '12/3 ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000',
      }),
    );
  });

  it('รับ URL แบบ path-style ของ Spaces ได้', async () => {
    const { service, client } = makeService();
    await service.create(
      '10075',
      dtoWithPhoto(
        `https://sgp1.digitaloceanspaces.com/${BUCKET}/customer-return/photos/10075/1-ab.jpg`,
      ),
    );
    expect(client.post).toHaveBeenCalled();
  });

  it.each([
    [
      'รูปของร้านอื่น',
      `https://${BUCKET}.sgp1.digitaloceanspaces.com/customer-return/photos/99999/1.jpg`,
    ],
    [
      'host ภายนอก',
      'https://evil.example.com/customer-return/photos/10075/1.jpg',
    ],
    [
      'key ที่ไม่ได้ขึ้นต้นด้วย prefix',
      `https://${BUCKET}.sgp1.digitaloceanspaces.com/other/customer-return/photos/10075/1.jpg`,
    ],
    [
      'path traversal แบบ encode',
      `https://${BUCKET}.sgp1.digitaloceanspaces.com/customer-return/photos/10075/%2e%2e/99999/1.jpg`,
    ],
  ])('create ปฏิเสธ %s', async (_label, url) => {
    const { service, client } = makeService();
    await expect(service.create('10075', dtoWithPhoto(url))).rejects.toThrow(
      BadRequestException,
    );
    expect(client.post).not.toHaveBeenCalled();
  });

  it('recentCompleted คืนเฉพาะ stage 5 ภายใน 7 วัน', async () => {
    const { service, client } = makeService();
    const now = Date.now();
    client.get.mockResolvedValue([
      {
        return_no: 'A',
        stage: 5,
        method: 'refund',
        completed_at: new Date(now - 86400000).toISOString(),
        receipt_doc_no: 'RTIV-1',
        receipt_net_total: '10.00',
      },
      {
        return_no: 'B',
        stage: 5,
        method: 'refund',
        completed_at: new Date(now - 8 * 86400000).toISOString(),
        receipt_doc_no: 'RTIV-2',
        receipt_net_total: '10.00',
      },
      {
        return_no: 'C',
        stage: 3,
        method: 'refund',
        completed_at: null,
        receipt_doc_no: null,
        receipt_net_total: null,
      },
    ]);
    const res = await service.recentCompleted('10075');
    expect(res.map((r) => r.return_no)).toEqual(['A']);
  });

  it('handleCompleted ไม่ล้มเมื่อ notification-service ล่ม', async () => {
    const { service, http } = makeService();
    http.post.mockReturnValue(throwError(() => new Error('down')));
    await expect(
      service.handleCompleted({
        return_no: 'RT69-10-0001',
        mem_code: '10075',
        method: 'credit',
        receipt_doc_no: 'RTIV-68214',
        receipt_net_total: 1325.5,
      }),
    ).resolves.toEqual({ success: true, push_sent: false });
  });

  describe('completedMessage', () => {
    const base = {
      return_no: 'RT69-10-0001',
      mem_code: '10075',
      receipt_doc_no: 'RTIV-68214',
      receipt_net_total: 160,
    };
    it('คืนได้ทั้งหมด: บอกเลขใบรับคืน รูปแบบ และยอดสุทธิ', () => {
      const m = completedMessage({
        ...base,
        method: 'credit',
        outcome: 'accepted',
      });
      expect(m.title).toBe('คืนสินค้าเรียบร้อย');
      expect(m.message).toContain('RTIV-68214');
      expect(m.message).toContain('หักลดในบัญชี');
      expect(m.message).toContain('160.00');
    });
    it('คืนได้บางรายการ: ระบุว่าบางรายการ', () => {
      const m = completedMessage({
        ...base,
        method: 'refund',
        outcome: 'partial',
      });
      expect(m.message).toContain('บางรายการ');
    });
    it('คืนไม่ได้ทั้งหมด: ไม่มีใบรับคืน ให้ไปดูเหตุผล', () => {
      const m = completedMessage({
        return_no: 'RT69-10-0002',
        mem_code: '10075',
        method: null,
        outcome: 'rejected',
        receipt_doc_no: null,
        receipt_net_total: null,
      });
      expect(m.title).toContain('ไม่ผ่าน');
      expect(m.message).toContain('เหตุผล');
    });
  });
});
