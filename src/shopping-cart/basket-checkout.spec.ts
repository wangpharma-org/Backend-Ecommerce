import { Test } from '@nestjs/testing';
import { DataSource, EntityManager, In, UpdateQueryBuilder } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShoppingCartService } from './shopping-cart.service';
import { ShoppingCartEntity } from './shopping-cart.entity';
import { DeleteCartEntity } from './delete-cart.entity';
import { ProductEntity } from 'src/products/products.entity';
import { ProductUnitEntity } from 'src/products/product-unit.entity';
import { UserEntity } from 'src/users/users.entity';
import { PromotionEntity } from 'src/promotion/promotion.entity';
import { PromotionTierEntity } from 'src/promotion/promotion-tier.entity';
import { PromotionConditionEntity } from 'src/promotion/promotion-condition.entity';
import { ProductsService } from 'src/products/products.service';
import { HotdealService } from 'src/hotdeal/hotdeal.service';
import { HotdealEntity } from 'src/hotdeal/hotdeal.entity';
import { PreorderProductEntity } from 'src/preorder/preorder-product.entity';
import { CompanyDayAnalyticService } from 'src/company-day-analytic/company-day-analytic.service';
import { CartBasketEntity } from 'src/special-collection/cart-basket.entity';

function repositoryMock() {
  const builder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    setLock: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
    getRawMany: jest.fn().mockResolvedValue([]),
  };
  return {
    builder,
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn((input: Partial<ShoppingCartEntity>) =>
      Object.assign(new ShoppingCartEntity(), input),
    ),
    save: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => builder),
  };
}

function product(code = 'PAID', threshold = 10): ProductEntity {
  return Object.assign(new ProductEntity(), {
    pro_code: code,
    pro_priceA: '5',
    pro_priceB: '10',
    pro_priceC: '15',
    pro_promotion_month: 10,
    pro_promotion_amount: threshold,
    units: [
      Object.assign(new ProductUnitEntity(), {
        pro_code: code,
        level: 1,
        ratio: 1,
        unit_name: 'ชิ้น',
      }),
      Object.assign(new ProductUnitEntity(), {
        pro_code: code,
        level: 2,
        ratio: 5,
        unit_name: 'กล่อง',
      }),
    ],
  });
}

function line(id: number, qty: number, item = product()): ShoppingCartEntity {
  return Object.assign(new ShoppingCartEntity(), {
    spc_id: id,
    mem_code: 'MEM1',
    basket_id: 10,
    pro_code: item.pro_code,
    spc_amount: qty,
    spc_unit_enum: '1',
    spc_checked: true,
    is_reward: false,
    hotdeal_free: false,
    spc_fixed_total: null,
    flashsale_end: null,
    product: item,
    member: Object.assign(new UserEntity(), {
      mem_code: 'MEM1',
      mem_price: 'B',
    }),
  });
}

describe('basket checkout isolation', () => {
  let service: ShoppingCartService;
  let cartRepo: ReturnType<typeof repositoryMock>;
  let basketRepo: ReturnType<typeof repositoryMock>;
  let allRepos: Array<ReturnType<typeof repositoryMock>>;

  beforeEach(async () => {
    jest.useFakeTimers({ now: new Date('2026-10-03T10:00:00Z') });
    cartRepo = repositoryMock();
    basketRepo = repositoryMock();
    const cartManager = { getRepository: jest.fn(() => basketRepo) };
    const entities = [
      PromotionTierEntity,
      PromotionConditionEntity,
      PromotionEntity,
      UserEntity,
      ProductEntity,
      DeleteCartEntity,
      HotdealEntity,
      PreorderProductEntity,
    ];
    allRepos = [cartRepo, basketRepo, ...entities.map(() => repositoryMock())];
    const module = await Test.createTestingModule({
      providers: [
        ShoppingCartService,
        {
          provide: getRepositoryToken(ShoppingCartEntity),
          useValue: { ...cartRepo, manager: cartManager },
        },
        { provide: getRepositoryToken(CartBasketEntity), useValue: basketRepo },
        ...entities.map((entity, index) => ({
          provide: getRepositoryToken(entity),
          useValue: allRepos[index + 2],
        })),
        { provide: ProductsService, useValue: {} },
        { provide: HotdealService, useValue: {} },
        { provide: CompanyDayAnalyticService, useValue: {} },
      ],
    }).compile();
    service = module.get(ShoppingCartService);
    allRepos[entities.indexOf(UserEntity) + 2].findOne.mockResolvedValue({
      mem_code: 'MEM1',
      mem_route: 'NORMAL',
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function transactionManager() {
    const source = new DataSource({
      type: 'mysql',
      entities: [ShoppingCartEntity, CartBasketEntity, UserEntity],
    });
    const manager = new EntityManager(source);
    const repo = manager.getRepository(ShoppingCartEntity);
    const readRows = jest.spyOn(repo, 'find');
    const deleteRows = jest
      .spyOn(repo, 'delete')
      .mockResolvedValue({ affected: 1, raw: [] });
    const deleteEntities = jest
      .spyOn(manager, 'delete')
      .mockResolvedValue({ affected: 2, raw: [] });
    const versionQuery = jest.spyOn(manager, 'createQueryBuilder');
    const versionExecute = jest
      .spyOn(UpdateQueryBuilder.prototype, 'execute')
      .mockResolvedValue({ affected: 1, raw: [], generatedMaps: [] });
    return {
      manager,
      readRows,
      deleteRows,
      deleteEntities,
      versionQuery,
      versionExecute,
    };
  }

  function expectNoGlobalWrites() {
    for (const repo of allRepos) {
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    }
  }

  it('cleanup deletes only saved purchased scope and resyncs stale hotdeal gifts in the same manager', async () => {
    const txn = transactionManager();
    const stale = Object.assign(line(77, 1, product('OLD-GIFT')), {
      basket_id: null,
      hotdeal_free: true,
      hotdeal_promain: 'OLD-MAIN',
    });
    txn.readRows.mockResolvedValueOnce([]).mockResolvedValueOnce([stale]);
    const recalculateRewards = jest
      .spyOn(service, 'checkPromotionReward')
      .mockResolvedValue(null);
    await service.clearBasketCheckout('MEM1', 10, [1, 2], 'B', txn.manager);
    expect(txn.deleteEntities).toHaveBeenNthCalledWith(1, ShoppingCartEntity, {
      mem_code: 'MEM1',
      basket_id: 10,
      spc_id: In([1, 2]),
    });
    expect(txn.deleteEntities).toHaveBeenNthCalledWith(2, CartBasketEntity, {
      mem_code: 'MEM1',
      basket_id: 10,
    });
    expect(recalculateRewards).toHaveBeenCalledWith('MEM1', 'B', txn.manager);
    expect(txn.deleteRows).toHaveBeenCalledWith({ spc_id: In([77]) });
    expect(txn.versionQuery).toHaveBeenCalledTimes(1);
    expect(txn.versionExecute).toHaveBeenCalledTimes(1);
    expect(txn.deleteEntities.mock.invocationCallOrder[0]).toBeLessThan(
      recalculateRewards.mock.invocationCallOrder[0],
    );
    expect(txn.deleteRows.mock.invocationCallOrder[0]).toBeLessThan(
      txn.versionExecute.mock.invocationCallOrder[0],
    );
    expectNoGlobalWrites();
  });

  it.each([1, 2])(
    'transaction delete failure at step %i propagates before reward resync or version update',
    async (failureStep) => {
      const txn = transactionManager();
      const failure = new Error('transaction delete failed');
      if (failureStep === 2)
        txn.deleteEntities.mockResolvedValueOnce({ affected: 2, raw: [] });
      txn.deleteEntities.mockRejectedValueOnce(failure);
      const recalculateRewards = jest
        .spyOn(service, 'checkPromotionReward')
        .mockResolvedValue(null);
      await expect(
        service.clearBasketCheckout('MEM1', 10, [1, 2], 'B', txn.manager),
      ).rejects.toBe(failure);
      expect(txn.deleteEntities).toHaveBeenCalledTimes(failureStep);
      expect(recalculateRewards).not.toHaveBeenCalled();
      expect(txn.readRows).not.toHaveBeenCalled();
      expect(txn.versionQuery).not.toHaveBeenCalled();
      expectNoGlobalWrites();
    },
  );

  it('remaining reward resync failure propagates before hotdeal writes or cart version update', async () => {
    const txn = transactionManager();
    const failure = new Error('reward resync failed');
    jest.spyOn(service, 'checkPromotionReward').mockRejectedValueOnce(failure);
    await expect(
      service.clearBasketCheckout('MEM1', 10, [1, 2], 'B', txn.manager),
    ).rejects.toBe(failure);
    expect(txn.deleteEntities).toHaveBeenCalledTimes(2);
    expect(txn.readRows).not.toHaveBeenCalled();
    expect(txn.versionQuery).not.toHaveBeenCalled();
    expectNoGlobalWrites();
  });

  it('omitted scope preserves ordinary checkout; numeric and query-string IDs are accepted', () => {
    expect(service.parseBasketCheckoutId(undefined)).toBeUndefined();
    expect(service.parseBasketCheckoutId(10)).toBe(10);
    expect(service.parseBasketCheckoutId('10')).toBe(10);
  });

  it.each<unknown>([
    null,
    '',
    ' ',
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    true,
    {},
    [],
    ['10'],
    ['10', '10'],
    '10,10',
    '1.5',
    '1e2',
    Number.MAX_SAFE_INTEGER + 1,
    String(Number.MAX_SAFE_INTEGER + 1),
  ])(
    'rejects malformed supplied scope %p without treating it as ordinary checkout',
    (value) => {
      expect(() => service.parseBasketCheckoutId(value)).toThrow(
        BadRequestException,
      );
    },
  );

  it('fixed line totals, including zero gift totals, override product prices', () => {
    const paid = Object.assign(line(1, 3), { spc_fixed_total: '12.50' });
    const gift = Object.assign(line(2, 1, product('GIFT')), {
      spc_fixed_total: 0,
    });
    const result = service.calculateCartSummary([paid, gift]);
    expect(result.total).toBe(12.5);
    expect(result.lines).toEqual([
      { spc_id: 1, pro_code: 'PAID', amount: 12.5 },
      { spc_id: 2, pro_code: 'GIFT', amount: 0 },
    ]);
  });

  it('monthly promotion qualifies using only supplied rows, excluding the same code elsewhere', () => {
    const selected = line(1, 6);
    const unrelated = Object.assign(line(2, 99), { basket_id: 20 });
    const selectedSummary = service.calculateCartSummary([selected]);
    expect(selectedSummary.total).toBe(60);
    expect(service.calculateCartSummary([selected, unrelated]).total).toBe(525);
    expect(selectedSummary.lines.map((entry) => entry.spc_id)).toEqual([1]);
  });

  it('virtual promotion and hotdeal gifts do not inflate paid totals or monthly qualification', () => {
    const paid = line(1, 6);
    const promoGift = Object.assign(line(-1, 100), { is_reward: true });
    const hotdealGift = Object.assign(line(-2, 100), { hotdeal_free: true });
    const result = service.calculateCartSummary([paid, promoGift, hotdealGift]);
    expect(result.total).toBe(60);
    expect(result.lines).toEqual([{ spc_id: 1, pro_code: 'PAID', amount: 60 }]);
  });

  it('monthly threshold aggregates converted units across selected same-product rows', () => {
    const first = line(1, 5);
    const second = Object.assign(line(2, 1), { spc_unit_enum: '2' });
    expect(service.calculateCartSummary([first, second]).total).toBe(50);
  });

  it('active flash sale uses A price while expired flash sale returns member tier', () => {
    const item = product('PAID', 100);
    const active = Object.assign(line(1, 2, item), {
      flashsale_end: '2026-10-04T10:00:00Z',
    });
    const expired = Object.assign(line(2, 2, item), {
      flashsale_end: '2026-10-02T10:00:00Z',
    });
    expect(service.calculateCartSummary([active]).total).toBe(10);
    expect(service.calculateCartSummary([expired]).total).toBe(20);
  });

  it('invalid unit cannot silently produce a valid zero checkout total', () => {
    const invalid = Object.assign(line(1, 1), { product: product('PAID') });
    invalid.product.units = [];
    expect(() => service.calculateCartSummary([invalid])).toThrow();
  });

  it('scoped snapshot generates virtual hotdeal gifts while preserving saved cart rows', async () => {
    const paid = line(1, 6);
    const unchecked = Object.assign(line(2, 99), { spc_checked: false });
    const storedRows = [paid, unchecked];
    basketRepo.findOne.mockResolvedValue({ basket_id: 10, mem_code: 'MEM1' });
    cartRepo.builder.getMany.mockResolvedValue(storedRows);
    const giftProduct = product('GIFT');
    const hotdeal = Object.assign(new HotdealEntity(), {
      id: 1,
      product: paid.product,
      product2: giftProduct,
      pro1_amount: '3',
      pro1_unit: 'ชิ้น',
      pro2_amount: '2',
      pro2_unit: 'ชิ้น',
    });
    const hotdealRepo = allRepos[8];
    hotdealRepo.find.mockResolvedValue([hotdeal]);
    const snapshot = await service.getBasketCheckoutSnapshot('MEM1', 10);
    expect(snapshot.sourceIds).toEqual([1, 2]);
    const gift = snapshot.cart.find((row) => row.hotdeal_free);
    expect(gift?.pro_code).toBe('GIFT');
    expect(gift?.spc_amount).toBe(4);
    expect(gift?.spc_id).toBeLessThan(0);
    expect(
      snapshot.cart.filter((row) => row.spc_id > 0).map((row) => row.spc_id),
    ).toEqual([1]);
    expect(service.calculateCartSummary(snapshot.cart).total).toBe(60);
    expect(storedRows).toEqual([paid, unchecked]);
    expect(paid.promo_id).toBeUndefined();
    expect(unchecked.spc_checked).toBe(false);
    for (const repo of allRepos) {
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    }
  });

  it('unowned or missing basket is rejected before loading rows or writing global cart', async () => {
    await expect(
      service.getBasketCheckoutSnapshot('MEM1', 10),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(basketRepo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { basket_id: 10, mem_code: 'MEM1' },
      }),
    );
    expect(cartRepo.createQueryBuilder).not.toHaveBeenCalled();
    for (const repo of allRepos) {
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
      expect(repo.remove).not.toHaveBeenCalled();
      expect(repo.delete).not.toHaveBeenCalled();
    }
  });

  it('owned basket with no purchasable rows rejects without falling back to global cart', async () => {
    basketRepo.findOne.mockResolvedValue({ basket_id: 10, mem_code: 'MEM1' });
    cartRepo.builder.getMany.mockResolvedValue([
      Object.assign(line(1, 1), { spc_checked: false }),
    ]);
    await expect(
      service.getBasketCheckoutSnapshot('MEM1', 10),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(cartRepo.builder.where).toHaveBeenCalledWith(
      expect.stringContaining('mem_code'),
      expect.objectContaining({ mem_code: 'MEM1' }),
    );
    expect(cartRepo.builder.andWhere).toHaveBeenCalledWith(
      expect.stringContaining('basket_id'),
      expect.objectContaining({ basketId: 10 }),
    );
  });
});
