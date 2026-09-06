import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { BundleSetService, type SetLineView } from './bundle-set.service';
import { BundleSetEntity } from './bundle-set.entity';
import { BundleSetItemEntity } from './bundle-set-item.entity';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';

/**
 * BundleSetService unit tests
 * เน้นเลขที่พลาดแล้วเงิน/สต็อกเพี้ยน: การเฉลี่ยราคาชุด และการนับจำนวนชุดที่สั่งได้
 */

const buildRepoMock = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((row: unknown) => row),
  delete: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const line = (overrides: Partial<SetLineView> = {}): SetLineView => ({
  item_id: 1,
  pro_code: 'P-001',
  pro_name: 'ไดอะบีเดิร์มครีม 20% 35ก',
  unit_level: 1,
  unit_name: 'หลอด',
  qty: 1,
  is_gift: false,
  unit_price: 100,
  line_total: 100,
  ...overrides,
});

describe('BundleSetService', () => {
  let service: BundleSetService;
  let setRepo: ReturnType<typeof buildRepoMock>;
  let itemRepo: ReturnType<typeof buildRepoMock>;
  let productRepo: ReturnType<typeof buildRepoMock>;
  let unitRepo: ReturnType<typeof buildRepoMock>;

  beforeEach(async () => {
    setRepo = buildRepoMock();
    itemRepo = buildRepoMock();
    productRepo = buildRepoMock();
    unitRepo = buildRepoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BundleSetService,
        { provide: getRepositoryToken(BundleSetEntity), useValue: setRepo },
        {
          provide: getRepositoryToken(BundleSetItemEntity),
          useValue: itemRepo,
        },
        { provide: getRepositoryToken(ProductEntity), useValue: productRepo },
        { provide: getRepositoryToken(ProductUnitEntity), useValue: unitRepo },
      ],
    }).compile();

    service = module.get<BundleSetService>(BundleSetService);
  });

  describe('explodeLines', () => {
    it('ผลรวมทุกบรรทัดเท่ากับราคาชุดเป๊ะ แม้หารไม่ลงตัว', () => {
      const lines = [
        line({ item_id: 1, pro_code: 'A', line_total: 1000 }),
        line({ item_id: 2, pro_code: 'B', line_total: 1000 }),
        line({ item_id: 3, pro_code: 'C', line_total: 1000 }),
      ];

      const exploded = service.explodeLines(lines, 2900, 1);
      const sum = exploded.reduce((acc, row) => acc + row.line_total, 0);

      expect(Math.round(sum * 100) / 100).toBe(2900);
    });

    it('บรรทัดสุดท้ายรับเศษ ไม่ใช่ปัดทิ้ง', () => {
      const lines = [
        line({ item_id: 1, pro_code: 'A', line_total: 1 }),
        line({ item_id: 2, pro_code: 'B', line_total: 1 }),
        line({ item_id: 3, pro_code: 'C', line_total: 1 }),
      ];

      const exploded = service.explodeLines(lines, 100, 1);
      const sum = exploded.reduce((acc, row) => acc + row.line_total, 0);

      expect(Math.round(sum * 100) / 100).toBe(100);
      // 100/3 = 33.33 สองบรรทัดแรก บรรทัดสุดท้ายต้องได้ 33.34
      expect(exploded[2].line_total).toBeCloseTo(33.34, 2);
    });

    it('คูณจำนวนชุด แล้วยอดรวมยังตรง', () => {
      const lines = [
        line({ item_id: 1, pro_code: 'A', line_total: 700 }),
        line({ item_id: 2, pro_code: 'B', line_total: 300 }),
      ];

      const exploded = service.explodeLines(lines, 820, 3);
      const sum = exploded.reduce((acc, row) => acc + row.line_total, 0);

      expect(Math.round(sum * 100) / 100).toBe(2460);
      expect(exploded[0].qty).toBe(3);
    });

    it('ของแถมราคาเป็น 0 และคูณจำนวนชุดด้วย', () => {
      const lines = [
        line({ item_id: 1, pro_code: 'A', line_total: 1000 }),
        line({
          item_id: 2,
          pro_code: 'GIFT',
          is_gift: true,
          qty: 5,
          line_total: 0,
        }),
      ];

      const exploded = service.explodeLines(lines, 900, 2);
      const gift = exploded.find((row) => row.pro_code === 'GIFT');

      expect(gift?.line_total).toBe(0);
      expect(gift?.qty).toBe(10);
      // ของแถมไม่กินส่วนแบ่งราคา — สินค้าหลักรับเต็ม
      expect(exploded[0].line_total).toBe(1800);
    });

    it('สินค้าไม่มีราคาทั้งชุด → เฉลี่ยเท่ากัน ไม่หารด้วยศูนย์', () => {
      const lines = [
        line({ item_id: 1, pro_code: 'A', line_total: 0, unit_price: 0 }),
        line({ item_id: 2, pro_code: 'B', line_total: 0, unit_price: 0 }),
      ];

      const exploded = service.explodeLines(lines, 500, 1);
      const sum = exploded.reduce((acc, row) => acc + row.line_total, 0);

      expect(sum).toBe(500);
      expect(exploded.every((row) => Number.isFinite(row.line_total))).toBe(
        true,
      );
    });

    it('ปฏิเสธจำนวนชุดที่ไม่มากกว่า 0', () => {
      expect(() => service.explodeLines([line()], 100, 0)).toThrow(
        BadRequestException,
      );
    });
  });

  describe('getSetView — จำนวนชุดที่สั่งได้', () => {
    const mockSet = (
      items: Array<Partial<BundleSetItemEntity>>,
      products: Array<Partial<ProductEntity>>,
      units: Array<Partial<ProductUnitEntity>>,
      price = 1000,
    ) => {
      setRepo.findOne.mockResolvedValue({
        set_code: 'SET-DIA-X',
        set_name: 'กระเช้ามหาชน',
        price,
        items: items.map((item, index) => ({
          item_id: index + 1,
          set_code: 'SET-DIA-X',
          unit_level: 1,
          qty: 1,
          is_gift: false,
          sort_order: index,
          ...item,
        })),
      });
      productRepo.find.mockResolvedValue(products);
      unitRepo.find.mockResolvedValue(units);
    };

    it('จำกัดด้วยสินค้าที่สต็อกน้อยที่สุด และบอกว่าติดตัวไหน', async () => {
      mockSet(
        [
          { pro_code: 'A', qty: 2 },
          { pro_code: 'B', qty: 1 },
        ],
        [
          {
            pro_code: 'A',
            pro_name: 'สินค้า A',
            pro_stock: 10,
            pro_priceC: 50,
          },
          { pro_code: 'B', pro_name: 'สินค้า B', pro_stock: 3, pro_priceC: 50 },
        ],
        [
          { pro_code: 'A', level: 1, ratio: 1, unit_name: 'หลอด' },
          { pro_code: 'B', level: 1, ratio: 1, unit_name: 'ขวด' },
        ],
      );

      const view = await service.getSetView('SET-DIA-X', 'C');

      // A ทำได้ 5 ชุด (10/2) แต่ B ทำได้แค่ 3 → ตอบ 3
      expect(view.availability.available_sets).toBe(3);
      expect(view.availability.limiting_pro_code).toBe('B');
    });

    it('คิด ratio ของหน่วยใหญ่ด้วย ไม่ใช่นับเป็นชิ้น', async () => {
      mockSet(
        [{ pro_code: 'A', qty: 1, unit_level: 2 }],
        [
          {
            pro_code: 'A',
            pro_name: 'สินค้า A',
            pro_stock: 100,
            pro_priceC: 10,
          },
        ],
        [
          { pro_code: 'A', level: 1, ratio: 1, unit_name: 'ชิ้น' },
          { pro_code: 'A', level: 2, ratio: 12, unit_name: 'กล่อง' },
        ],
      );

      const view = await service.getSetView('SET-DIA-X', 'C');

      // 1 กล่อง = 12 ชิ้น → 100/12 = 8 ชุด
      expect(view.availability.available_sets).toBe(8);
      expect(view.items[0].unit_name).toBe('กล่อง');
      expect(view.items[0].line_total).toBe(120);
    });

    it('ของแถมในชุดก็ตัดสต็อก จึงกดจำนวนชุดลงได้', async () => {
      mockSet(
        [
          { pro_code: 'A', qty: 1 },
          { pro_code: 'GIFT', qty: 1, is_gift: true },
        ],
        [
          {
            pro_code: 'A',
            pro_name: 'สินค้า A',
            pro_stock: 50,
            pro_priceC: 10,
          },
          { pro_code: 'GIFT', pro_name: 'ของแถม', pro_stock: 2, pro_priceC: 5 },
        ],
        [
          { pro_code: 'A', level: 1, ratio: 1, unit_name: 'ชิ้น' },
          { pro_code: 'GIFT', level: 1, ratio: 1, unit_name: 'ชิ้น' },
        ],
      );

      const view = await service.getSetView('SET-DIA-X', 'C');

      expect(view.availability.available_sets).toBe(2);
      expect(view.availability.limiting_pro_code).toBe('GIFT');
    });

    it('สินค้าในชุดหายไปจากระบบ → สั่งไม่ได้เลย', async () => {
      mockSet([{ pro_code: 'GONE', qty: 1 }], [], []);

      const view = await service.getSetView('SET-DIA-X', 'C');

      expect(view.availability.available_sets).toBe(0);
      expect(view.availability.limiting_pro_code).toBe('GONE');
    });

    it('คำนวณส่วนต่างจากราคาปกติ และไม่ติดลบเมื่อชุดแพงกว่า', async () => {
      mockSet(
        [{ pro_code: 'A', qty: 2 }],
        [
          {
            pro_code: 'A',
            pro_name: 'สินค้า A',
            pro_stock: 99,
            pro_priceC: 100,
          },
        ],
        [{ pro_code: 'A', level: 1, ratio: 1, unit_name: 'ชิ้น' }],
        250,
      );

      const view = await service.getSetView('SET-DIA-X', 'C');

      expect(view.list_total).toBe(200);
      expect(view.savings).toBe(0);
    });
  });
});
