import { ForbiddenException } from '@nestjs/common';
import { ProductEntity } from '../products/products.entity';
import { DrugTypeEntity } from './drug-type.entity';
import { DrugTypeRewardEntity } from './drug-type-reward.entity';
import {
  DRUG_TYPE_REWARD_FLAG,
  DrugTypeKafkaPayload,
  DrugTypeService,
} from './drug-type.service';

describe('WGDD-427 DrugTypeService', () => {
  const manager = {
    findOne: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    create: jest.fn((_entity: unknown, data: unknown) => data),
    save: jest.fn(),
  };
  const dataSource = {
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const qb = {
    innerJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn(),
  };
  const drugTypeRepo = { createQueryBuilder: jest.fn(() => qb) };
  const productRepo = { find: jest.fn() };
  const featureFlags = { getFlag: jest.fn() };
  const service = new DrugTypeService(
    drugTypeRepo as never,
    productRepo as never,
    dataSource as never,
    featureFlags as never,
  );

  const payload: DrugTypeKafkaPayload = {
    code: 'VITAMIN',
    previous_code: null,
    name: 'วิตามิน',
    description: null,
    is_active: true,
    deleted: false,
    rewards: [
      {
        reward_type: 'FREE',
        product_code: 'F-1',
        buy_qty: 10,
        buy_unit: 'กล่อง',
        reward_qty: 1,
        reward_unit: 'ขวด',
        bundle_price: null,
        sort_order: 0,
        note: null,
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  describe('feature flag', () => {
    it('throws Forbidden while drug_type_reward is off', async () => {
      featureFlags.getFlag.mockResolvedValue(false);

      await expect(service.assertEnabled()).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(featureFlags.getFlag).toHaveBeenCalledWith(DRUG_TYPE_REWARD_FLAG);
    });
  });

  describe('upsertFromKafka', () => {
    it('upserts the type and replaces the whole reward set', async () => {
      await service.upsertFromKafka(payload);

      expect(manager.upsert).toHaveBeenCalledWith(
        DrugTypeEntity,
        expect.objectContaining({ code: 'VITAMIN', is_active: true }),
        ['code'],
      );
      expect(manager.delete).toHaveBeenCalledWith(DrugTypeRewardEntity, {
        drug_type_code: 'VITAMIN',
      });
      expect(manager.save).toHaveBeenCalledWith([
        expect.objectContaining({
          drug_type_code: 'VITAMIN',
          product_code: 'F-1',
          buy_qty: 10,
          reward_unit: 'ขวด',
        }),
      ]);
    });

    it('deletes the type and clears products on deleted=true', async () => {
      await service.upsertFromKafka({ ...payload, deleted: true, rewards: [] });

      expect(manager.update).toHaveBeenCalledWith(
        ProductEntity,
        { drug_type_code: 'VITAMIN' },
        { drug_type_code: null },
      );
      expect(manager.delete).toHaveBeenCalledWith(DrugTypeEntity, {
        code: 'VITAMIN',
      });
      expect(manager.upsert).not.toHaveBeenCalled();
    });

    it('renames the type and moves products when previous_code is sent', async () => {
      manager.findOne
        .mockResolvedValueOnce({ code: 'VIT-OLD' }) // old exists
        .mockResolvedValueOnce(null); // new does not

      await service.upsertFromKafka({ ...payload, previous_code: 'VIT-OLD' });

      expect(manager.update).toHaveBeenCalledWith(
        DrugTypeEntity,
        { code: 'VIT-OLD' },
        { code: 'VITAMIN' },
      );
      expect(manager.update).toHaveBeenCalledWith(
        ProductEntity,
        { drug_type_code: 'VIT-OLD' },
        { drug_type_code: 'VITAMIN' },
      );
    });

    it('skips messages without a code', async () => {
      await service.upsertFromKafka({ ...payload, code: ' ' });

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });

  describe('findByProductCodes', () => {
    it('returns rewards keyed by pro_code with reward product names', async () => {
      productRepo.find
        .mockResolvedValueOnce([
          { pro_code: 'P1', drug_type_code: 'VITAMIN' },
          { pro_code: 'P2', drug_type_code: null },
        ])
        .mockResolvedValueOnce([
          {
            pro_code: 'F-1',
            pro_name: 'EASYACC NAME',
            pro_nameTH: 'ถุงผ้า',
            pro_imgmain: 'img.jpg',
          },
        ]);
      qb.getMany.mockResolvedValue([
        { code: 'VITAMIN', name: 'วิตามิน', rewards: payload.rewards },
      ]);

      const result = await service.findByProductCodes(['P1', 'P2']);

      expect(Object.keys(result)).toEqual(['P1']);
      expect(result.P1.rewards[0]).toEqual(
        expect.objectContaining({
          product_code: 'F-1',
          product_name: 'ถุงผ้า',
          product_image: 'img.jpg',
          buy_qty: 10,
        }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('dt.is_active = 1');
    });

    it('does not query types when no product has a drug type', async () => {
      productRepo.find.mockResolvedValueOnce([
        { pro_code: 'P2', drug_type_code: null },
      ]);

      await expect(service.findByProductCodes(['P2'])).resolves.toEqual({});
      expect(drugTypeRepo.createQueryBuilder).not.toHaveBeenCalled();
    });
  });
});
