import { ProductsService } from './products.service';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';
import { HappyHourService } from '../happy-hour/happy-hour.service';

// Project mock rows through the actual select list, so omitted API columns fail these tests.
function queryMock(rows: Record<string, unknown>[], raw = false) {
  let fields: string[] = [];
  const project = () =>
    rows.map((row) =>
      Object.fromEntries(
        fields.map((field) => {
          const key = raw ? field.split(' AS ')[1] : field.split('.').at(-1)!;
          return [key, row[key]];
        }),
      ),
    );
  const qb: Record<string, jest.Mock> = {};
  for (const method of [
    'leftJoinAndSelect',
    'leftJoin',
    'innerJoinAndSelect',
    'where',
    'andWhere',
    'setParameter',
    'orderBy',
    'delete',
    'from',
  ]) {
    qb[method] = jest.fn(() => qb);
  }
  qb.select = jest.fn((selected: string[]) => {
    fields = selected;
    return qb;
  });
  qb.getMany = jest.fn(() => Promise.resolve(project()));
  qb.getRawMany = jest.fn(() => Promise.resolve(project()));
  qb.getOne = jest.fn(() => Promise.resolve(project()[0]));
  qb.execute = jest.fn(() => Promise.resolve({ affected: 0 }));
  return qb;
}

const product = {
  pro_code: 'P001',
  pro_name: 'EasyAcc original',
  pro_nameTH: 'ชื่อสินค้าไทย',
  pro_nameSale: 'ชื่อขาย',
  pro_imgmain: '',
};

describe('ECWC-421 product name responses', () => {
  it('includes both names in product detail and selects names for related products', async () => {
    const qb = queryMock([product]);
    const service: ProductsService = Object.assign(
      Object.create(ProductsService.prototype) as ProductsService,
      {
        productRepo: { createQueryBuilder: () => qb, increment: jest.fn() },
        isL16Member: jest.fn(() => Promise.resolve(false)),
        transformProductWithUnits: jest.fn((value: unknown) =>
          Promise.resolve(value),
        ),
      },
    );
    const result = await service.getProductDetail({
      pro_code: 'P001',
      mem_code: 'TEST',
    });
    expect(result).toMatchObject(product);
    expect(qb.select).toHaveBeenCalledWith(
      expect.arrayContaining(['products.pro_nameTH', 'replace.pro_nameTH']),
    );
  });

  it.each(['replace', 'recommended'])(
    'preserves names in cart and %s products',
    async (kind) => {
      const row = {
        ...product,
        pro_priceA: '10',
        pro_priceB: '10',
        pro_priceC: '10',
        spc_id: 1,
        spc_amount: '2',
        spc_unit_enum: '1',
        spc_checked: true,
        recommended_id: 1,
        [`${kind}_pro_code`]: 'P002',
        [`${kind}_pro_name`]: 'EasyAcc related',
        [`${kind}_pro_nameTH`]: 'สินค้าแนะนำไทย',
        [`${kind}_pro_nameSale`]: 'ชื่อขายสินค้าแนะนำ',
      };
      const qb = queryMock([row], true);
      const service: ShoppingCartService = Object.assign(
        Object.create(ShoppingCartService.prototype) as ShoppingCartService,
        {
          shoppingCartRepo: {
            createQueryBuilder: () => qb,
            find: jest.fn(() => Promise.resolve([])),
          },
          productRepo: { createQueryBuilder: () => qb },
          removeL16ItemsFromCart: jest.fn(),
          isL16Member: jest.fn(() => Promise.resolve(false)),
          hotdealService: {
            getHotdealByProCode: jest.fn(() => Promise.resolve([])),
          },
          productsService: {
            getUnitsMapByProCodes: jest.fn(() => Promise.resolve(new Map())),
          },
          transformProductWithUnits: jest.fn((value: object) =>
            Promise.resolve({
              ...value,
              pro_unit1: 'ชิ้น',
              pro_ratio1: 1,
            }),
          ),
          calculateUsedHotdealPoints: jest.fn(() => Promise.resolve(0)),
          getHotdealPointsInfo: jest.fn(() => Promise.resolve(null)),
          logger: { error: jest.fn(), warn: jest.fn() },
        },
      );
      const result = await service.getProductCart('TEST', {
        syncHotdeal: false,
      });
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ ...product, totalSmallestUnit: 2 });
      expect(result[0].recommend[0]).toMatchObject({
        pro_name: 'EasyAcc related',
        pro_nameTH: 'สินค้าแนะนำไทย',
        pro_nameSale: 'ชื่อขายสินค้าแนะนำ',
      });
    },
  );

  it('adds current Thai names to qualifying products even when a slot has no rewards', async () => {
    const qb = queryMock([product]);
    const service: HappyHourService = Object.assign(
      Object.create(HappyHourService.prototype) as HappyHourService,
      {
        slotRepo: {
          find: jest.fn(() =>
            Promise.resolve([
              {
                rewards: [],
                minOrderProducts: [
                  { id: 1, pro_code: 'P001', pro_name: 'Stored EasyAcc name' },
                ],
              },
            ]),
          ),
        },
        productRepo: { createQueryBuilder: () => qb },
      },
    );
    const slots = await service.getSlots();
    expect(slots[0]?.min_order_products[0]).toMatchObject({
      pro_name: 'Stored EasyAcc name',
      pro_nameTH: product.pro_nameTH,
    });
    expect(qb.getMany).toHaveBeenCalledTimes(1);
  });

  it.each([product.pro_nameTH, null])(
    'includes nullable Thai reward names without changing reward quantities (%s)',
    async (thaiName) => {
      const qb = queryMock([{ ...product, pro_nameTH: thaiName }]);
      const slotQb = queryMock([]);
      slotQb.getOne.mockResolvedValue({
        min_order_amount: 100,
        excess_threshold: 100,
        discount_per_step: 10,
        card_value: 20,
        rewards: [{ pro_code: 'P001', amount: 2, unit: 'ชิ้น' }],
      });
      const service: HappyHourService = Object.assign(
        Object.create(HappyHourService.prototype) as HappyHourService,
        {
          getConfig: jest.fn(() => Promise.resolve({ is_enabled: true })),
          slotRepo: { createQueryBuilder: () => slotQb },
          productRepo: { createQueryBuilder: () => qb },
        },
      );
      const result = await service.getCartPreview({ order_amount: 200 });
      expect(result.reward_items?.[0]).toMatchObject({
        pro_name: product.pro_name,
        pro_nameTH: thaiName,
        pro_nameSale: product.pro_nameSale,
        amount: 4,
        unit: 'ชิ้น',
      });
    },
  );
});
