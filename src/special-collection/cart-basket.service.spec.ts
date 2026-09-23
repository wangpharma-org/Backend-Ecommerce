import { Test, type TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { CartBasketService } from './cart-basket.service';
import { CartBasketEntity } from './cart-basket.entity';
import { ShoppingCartEntity } from '../shopping-cart/shopping-cart.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { PromotionEntity } from '../promotion/promotion.entity';
import { PromotionTierEntity } from '../promotion/promotion-tier.entity';
import { ProductEntity } from '../products/products.entity';
import { ProductUnitEntity } from '../products/product-unit.entity';
import { BundleSetEntity } from '../bundle-set/bundle-set.entity';
import { BundleSetService } from '../bundle-set/bundle-set.service';

/**
 * เน้นเคสที่พังเงียบได้: แอดมินแก้เงื่อนไขโปรกลางคันทั้งที่ลูกค้าใส่กระเช้าไปแล้ว
 * ของเดิม lowestTier โยน NotFound ทำให้ GET /basket ล้มทั้ง endpoint
 * กระเช้าของโปรอื่นหายจากตะกร้าไปด้วย และแถวในตะกร้าหลุดไปโผล่เป็นสินค้าเดี่ยว
 */
const repoMock = () => ({
  find: jest.fn().mockResolvedValue([]),
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn(),
  create: jest.fn((row: unknown) => row),
  delete: jest.fn(),
});

describe('CartBasketService — โปรถูกแก้เงื่อนไขกลางคัน', () => {
  let service: CartBasketService;
  let basketRepo: ReturnType<typeof repoMock>;
  let cartRepo: ReturnType<typeof repoMock>;
  let tierRepo: ReturnType<typeof repoMock>;
  let promotionRepo: ReturnType<typeof repoMock>;
  let unitRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    basketRepo = repoMock();
    cartRepo = repoMock();
    tierRepo = repoMock();
    promotionRepo = repoMock();
    unitRepo = repoMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CartBasketService,
        { provide: getRepositoryToken(CartBasketEntity), useValue: basketRepo },
        {
          provide: getRepositoryToken(ShoppingCartEntity),
          useValue: cartRepo,
        },
        {
          provide: getRepositoryToken(PromotionEntity),
          useValue: promotionRepo,
        },
        { provide: getRepositoryToken(PromotionTierEntity), useValue: tierRepo },
        { provide: getRepositoryToken(ProductEntity), useValue: repoMock() },
        { provide: getRepositoryToken(ProductUnitEntity), useValue: unitRepo },
        { provide: getRepositoryToken(BundleSetEntity), useValue: repoMock() },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: ShoppingCartService,
          useValue: {
            checkPromotionReward: jest.fn(),
            bumpCartVersion: jest.fn().mockResolvedValue({
              cartVersion: '1',
              cartSyncedAt: new Date(),
            }),
          },
        },
        { provide: BundleSetService, useValue: {} },
      ],
    }).compile();

    service = module.get(CartBasketService);
  });

  const givenBasketInCart = () => {
    basketRepo.find.mockResolvedValue([
      {
        basket_id: 7,
        mem_code: 'E2E-TEST',
        promo_id: 196,
        set_code: null,
        created_at: new Date(),
      },
    ]);
    cartRepo.find.mockResolvedValue([
      {
        spc_id: 101,
        pro_code: 'P1',
        spc_amount: 2,
        spc_unit_enum: '1',
        basket_id: 7,
        product: {
          pro_code: 'P1',
          pro_name: 'สินค้าทดสอบ',
          pro_imgmain: null,
          pro_priceA: 100,
          pro_priceB: 100,
          pro_priceC: 100,
        },
      },
    ]);
    unitRepo.find.mockResolvedValue([
      { pro_code: 'P1', level: 1, unit_name: 'ชิ้น', ratio: 1 },
    ]);
    promotionRepo.find.mockResolvedValue([
      { promo_id: 196, promo_name: 'โปรทดสอบ' },
    ]);
  };

  it('โปรไม่มีเงื่อนไขเหลือแล้ว ยังอ่านกระเช้าได้ ไม่โยน 404', async () => {
    givenBasketInCart();
    tierRepo.find.mockResolvedValue([]); // แอดมินลบขั้นทิ้งหมด

    const views = await service.listBaskets('E2E-TEST', 'C');

    expect(views).toHaveLength(1);
    expect(views[0].promo_ended).toBe(true);
    expect(views[0].qualifies).toBe(false);
    expect(views[0].reward_sets).toBe(0);
    // ของยังอยู่ในกระเช้า ไม่ได้หายไปจากตะกร้า
    expect(views[0].lines).toHaveLength(1);
    expect(views[0].total_amount).toBe(200);
  });

  it('โปรยังมีเงื่อนไขตามปกติ promo_ended = false และคิดของแถมให้', async () => {
    givenBasketInCart();
    tierRepo.find.mockResolvedValue([
      { tier_id: 1, min_amount: '100', is_unit: false },
    ]);

    const views = await service.listBaskets('E2E-TEST', 'C');

    expect(views[0].promo_ended).toBe(false);
    expect(views[0].qualifies).toBe(true);
    // ยอด 200 บนเกณฑ์ 100 = ได้ของแถม 2 ชุด
    expect(views[0].reward_sets).toBe(2);
  });
});
