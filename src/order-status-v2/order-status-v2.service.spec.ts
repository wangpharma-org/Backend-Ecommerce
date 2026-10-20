import { ConfigService } from '@nestjs/config';
import { OrderStatusV2Service } from './order-status-v2.service';

// ECWC-600: cleanRoad กับ toPublicCheckpoint เป็นฟังก์ชันล้วน ๆ ไม่แตะ repo/HTTP
// สร้าง service ตรง ๆ โดยส่ง dependency ปลอมเข้าไป จะได้ไม่ต้องตั้ง TestingModule ทั้งก้อน
const createService = () =>
  new OrderStatusV2Service(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { get: () => undefined } as unknown as ConfigService,
  );

describe('OrderStatusV2Service', () => {
  let service: OrderStatusV2Service;
  // cleanRoad / toPublicCheckpoint เป็น private — เข้าถึงผ่าน index เพื่อทดสอบตรงจุด
  let cleanRoad: (value: string | null | undefined) => string | null;
  let toPublicCheckpoint: (
    checkpoint: {
      type: 'DEPARTURE' | 'STORE_DELIVERED';
      latitude: string;
      longitude: string;
      time: string | null;
      mem_code?: string;
    } | null,
    nameGranted: boolean,
  ) => {
    type: string;
    latitude: string;
    longitude: string;
    time: string | null;
    approximate?: boolean;
  } | null;

  beforeEach(() => {
    service = createService();
    cleanRoad = (value) => service['cleanRoad'](value);
    toPublicCheckpoint = (checkpoint, nameGranted) =>
      service['toPublicCheckpoint'](checkpoint, nameGranted);
  });

  describe('cleanRoad', () => {
    it.each<[string | null | undefined, string]>([
      [null, 'ไม่มีค่า'],
      [undefined, 'undefined'],
      ['', 'ค่าว่าง'],
      ['   ', 'เว้นวรรคล้วน'],
      ['-', 'ขีดเดียว'],
      ['--', 'สองขีด'],
      ['ถนน', 'คำนำหน้าเปล่า'],
      ['ถ.', 'คำนำหน้าแบบย่อเปล่า'],
      ['ถ. -', 'คำนำหน้าแบบย่อ + ขีด'],
    ])('คืน null เมื่อค่าเป็น %p (%s)', (value) => {
      expect(cleanRoad(value)).toBeNull();
    });

    it.each<[string, string]>([
      ['กาญจนวนิช', 'ไม่มีคำนำหน้า'],
      ['ถนนกาญจนวนิช', 'ถนนติดกัน'],
      ['ถนน กาญจนวนิช', 'ถนนเว้นวรรค'],
      ['ถ.กาญจนวนิช', 'ถ. ติดกัน'],
      ['ถ. กาญจนวนิช', 'ถ. เว้นวรรค'],
      ['ถ กาญจนวนิช', 'ถ เว้นวรรคไม่มีจุด'],
      ['  ถ.กาญจนวนิช  ', 'มีช่องว่างหัวท้าย'],
    ])('ตัดคำนำหน้าออกจาก %p (%s)', (value) => {
      expect(cleanRoad(value)).toBe('กาญจนวนิช');
    });

    it('ไม่ตัด ถ ที่เป็นตัวแรกของชื่อถนนจริง', () => {
      expect(cleanRoad('ถวายพระ')).toBe('ถวายพระ');
    });

    it('ตัดเฉพาะคำนำหน้าคำแรก ชื่อถนนที่มีคำว่าถนนซ้ำยังอยู่ครบ', () => {
      expect(cleanRoad('ถนนนนทบุรี')).toBe('นนทบุรี');
    });
  });

  describe('toPublicCheckpoint', () => {
    const storeDelivered = {
      type: 'STORE_DELIVERED' as const,
      latitude: '7.008123',
      longitude: '100.476987',
      time: '2026-09-22T03:20:00.000Z',
      mem_code: 'M0001',
    };

    it('คืน null เมื่อไม่มี checkpoint', () => {
      expect(toPublicCheckpoint(null, true)).toBeNull();
    });

    it('ไม่ส่ง mem_code ของร้านอื่นต่อให้ลูกค้า ไม่ว่าร้านจะยินยอมหรือไม่', () => {
      expect(toPublicCheckpoint(storeDelivered, true)).not.toHaveProperty(
        'mem_code',
      );
      expect(toPublicCheckpoint(storeDelivered, false)).not.toHaveProperty(
        'mem_code',
      );
    });

    it('ร้านที่ยินยอม ได้พิกัดเต็มและไม่มี approximate', () => {
      expect(toPublicCheckpoint(storeDelivered, true)).toEqual({
        type: 'STORE_DELIVERED',
        latitude: '7.008123',
        longitude: '100.476987',
        time: '2026-09-22T03:20:00.000Z',
      });
    });

    it('ร้านที่ไม่ยินยอม ได้พิกัดปัด 3 ตำแหน่ง + approximate', () => {
      expect(toPublicCheckpoint(storeDelivered, false)).toEqual({
        type: 'STORE_DELIVERED',
        latitude: '7.008',
        longitude: '100.477',
        time: '2026-09-22T03:20:00.000Z',
        approximate: true,
      });
    });

    it('จุดออกรถเป็นคลังของเราเอง ไม่ปัดถึงแม้ไม่มีร้านที่ยินยอม', () => {
      expect(
        toPublicCheckpoint(
          {
            type: 'DEPARTURE',
            latitude: '7.008123',
            longitude: '100.476987',
            time: null,
          },
          false,
        ),
      ).toEqual({
        type: 'DEPARTURE',
        latitude: '7.008123',
        longitude: '100.476987',
        time: null,
      });
    });

    it('พิกัดที่แปลงเป็นตัวเลขไม่ได้ ส่งต่อตามเดิมแทนที่จะได้ NaN', () => {
      expect(
        toPublicCheckpoint(
          { ...storeDelivered, latitude: 'n/a', longitude: 'n/a' },
          false,
        ),
      ).toMatchObject({ latitude: 'n/a', longitude: 'n/a', approximate: true });
    });
  });
});
