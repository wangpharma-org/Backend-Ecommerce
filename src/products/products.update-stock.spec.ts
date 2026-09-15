import { ProductsService } from './products.service';
import { ProductEntity } from './products.entity';
import { LogFileEntity } from 'src/backend/logFile.entity';
import { BadRequestException } from '@nestjs/common';

describe('ProductsService.updateStock', () => {
  let service: ProductsService;
  let productRepo: {
    manager: {
      connection: { createQueryRunner: jest.Mock };
    };
    update: jest.Mock;
    save: jest.Mock;
  };
  let queryRunner: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    manager: {
      createQueryBuilder: jest.Mock;
      update: jest.Mock;
      create: jest.Mock;
      save: jest.Mock;
    };
  };
  let lineSupportService: { notifyRedeemStockOut: jest.Mock };
  let backendService: { updateLogFile: jest.Mock };
  let stockOutResults: { pro_code: string; pro_name: string | null }[][];
  let stockOutBuilders: Record<string, jest.Mock>[];
  let updateBuilders: Record<string, jest.Mock>[];

  beforeEach(() => {
    stockOutResults = [];
    stockOutBuilders = [];
    updateBuilders = [];

    queryRunner = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      manager: {
        createQueryBuilder: jest.fn((entity?: unknown, alias?: string) => {
          if (entity === ProductEntity && alias === 'product') {
            const builder: Record<string, jest.Mock> = {
              select: jest.fn().mockReturnThis(),
              addSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              setLock: jest.fn().mockReturnThis(),
              getRawMany: jest
                .fn()
                .mockResolvedValue(stockOutResults.shift() ?? []),
            };
            stockOutBuilders.push(builder);
            return builder;
          }

          const builder: Record<string, jest.Mock> = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            setParameters: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue({ affected: 1 }),
          };
          updateBuilders.push(builder);
          return builder;
        }),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        create: jest.fn(),
        save: jest.fn(),
      },
    };

    productRepo = {
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunner),
        },
      },
      update: jest.fn(),
      save: jest.fn(),
    };
    lineSupportService = {
      notifyRedeemStockOut: jest.fn().mockResolvedValue(true),
    };
    backendService = { updateLogFile: jest.fn() };

    service = new ProductsService(
      productRepo as never,
      {} as never,
      {} as never,
      {} as never,
      backendService as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      lineSupportService as never,
    );
  });

  it('uses the last duplicate value and notifies only positive-to-zero redeem products', async () => {
    stockOutResults.push([{ pro_code: 'B', pro_name: '   ' }]);

    await expect(
      service.updateStock({
        filename: 'stock.xlsx',
        group: [
          { pro_code: 'A', stock: 0 },
          { pro_code: 'A', stock: 7 },
          { pro_code: 'B', stock: 8 },
          { pro_code: 'B', stock: 0 },
          { pro_code: 'C', stock: 0 },
          { pro_code: 'D', stock: -1 },
        ],
      }),
    ).resolves.toBe('Stock updated successfully');

    expect(stockOutBuilders).toHaveLength(1);
    expect(stockOutBuilders[0].where).toHaveBeenCalledWith(
      'product.pro_code IN (:...zeroStockCodes)',
      { zeroStockCodes: ['B', 'C'] },
    );
    expect(stockOutBuilders[0].andWhere).toHaveBeenCalledWith(
      'product.pro_stock > :previousStock',
      { previousStock: 0 },
    );
    expect(stockOutBuilders[0].andWhere).toHaveBeenCalledWith(
      '(product.pro_free = :redeemFree OR product.pro_supplier = :redeemSupplier)',
      { redeemFree: true, redeemSupplier: '00' },
    );
    expect(stockOutBuilders[0].setLock).toHaveBeenCalledWith(
      'pessimistic_write',
    );
    expect(stockOutBuilders[0].orderBy).toHaveBeenCalledWith(
      'product.pro_code',
      'ASC',
    );

    expect(updateBuilders).toHaveLength(1);
    expect(updateBuilders[0].where).toHaveBeenCalledWith(
      'pro_code IN (:...updateCodes)',
      { updateCodes: ['A', 'B', 'C', 'D'] },
    );
    expect(updateBuilders[0].setParameters).toHaveBeenCalledWith({
      stockCode0: 'A',
      stockValue0: 7,
      stockCode1: 'B',
      stockValue1: 0,
      stockCode2: 'C',
      stockValue2: 0,
      stockCode3: 'D',
      stockValue3: -1,
    });
    expect(lineSupportService.notifyRedeemStockOut).toHaveBeenCalledTimes(1);
    expect(lineSupportService.notifyRedeemStockOut).toHaveBeenCalledWith({
      file_name: 'stock.xlsx',
      items: [{ pro_code: 'B', pro_name: 'B' }],
    });
    expect(
      queryRunner.commitTransaction.mock.invocationCallOrder[0],
    ).toBeLessThan(
      lineSupportService.notifyRedeemStockOut.mock.invocationCallOrder[0],
    );
  });

  it('does not query or notify when the effective payload has no exact zero stock', async () => {
    await service.updateStock({
      filename: 'positive.xlsx',
      group: [
        { pro_code: 'A', stock: 0 },
        { pro_code: 'A', stock: 2 },
        { pro_code: 'B', stock: -1 },
      ],
    });

    expect(stockOutBuilders).toHaveLength(0);
    expect(lineSupportService.notifyRedeemStockOut).not.toHaveBeenCalled();
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      LogFileEntity,
      { feature: 'UpdateStock' },
      expect.objectContaining({ filename: 'positive.xlsx' }),
    );
  });

  it('ignores missing products without inserting them or notifying for them', async () => {
    stockOutResults.push([{ pro_code: 'EXISTS', pro_name: null }]);

    await service.updateStock({
      filename: 'missing.xlsx',
      group: [
        { pro_code: 'MISSING', stock: 0 },
        { pro_code: 'EXISTS', stock: 0 },
      ],
    });

    expect(lineSupportService.notifyRedeemStockOut).toHaveBeenCalledWith({
      file_name: 'missing.xlsx',
      items: [{ pro_code: 'EXISTS', pro_name: 'EXISTS' }],
    });
    expect(queryRunner.manager.create).not.toHaveBeenCalled();
    expect(queryRunner.manager.save).not.toHaveBeenCalled();
    expect(productRepo.save).not.toHaveBeenCalled();
    expect(productRepo.update).not.toHaveBeenCalled();
  });

  it('bounds each parameterized bulk update to 1000 product codes', async () => {
    const group = Array.from({ length: 2001 }, (_, index) => ({
      pro_code: `SKU-${index}`,
      stock: index + 1,
    }));

    await service.updateStock({ filename: 'large.xlsx', group });

    expect(updateBuilders).toHaveLength(3);
    const sortedGroup = [...group].sort((left, right) =>
      left.pro_code < right.pro_code
        ? -1
        : left.pro_code > right.pro_code
          ? 1
          : 0,
    );
    const expectedChunks = [
      sortedGroup.slice(0, 1000),
      sortedGroup.slice(1000, 2000),
      sortedGroup.slice(2000),
    ];

    expectedChunks.forEach((chunk, index) => {
      const updateCodes = chunk.map((item) => item.pro_code);
      expect(updateBuilders[index].where).toHaveBeenCalledWith(
        'pro_code IN (:...updateCodes)',
        { updateCodes },
      );
      expect(updateBuilders[index].setParameters).toHaveBeenCalledWith(
        expect.objectContaining({
          stockCode0: updateCodes[0],
        }),
      );
      expect(updateBuilders[index].set).toHaveBeenCalledTimes(1);
    });
  });

  it.each([
    ['an empty group', []],
    ['a null item', [null]],
    ['an empty product code', [{ pro_code: ' ', stock: 1 }]],
    ['a non-string product code', [{ pro_code: {}, stock: 1 }]],
    ['a null stock', [{ pro_code: 'A', stock: null }]],
    ['a blank stock', [{ pro_code: 'A', stock: ' ' }]],
    ['a non-finite stock', [{ pro_code: 'A', stock: 'not-a-number' }]],
  ])('rejects %s before opening a database connection', async (_, group) => {
    await expect(
      service.updateStock({
        filename: 'invalid.xlsx',
        group: group as { pro_code: string; stock: number | string }[],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      productRepo.manager.connection.createQueryRunner,
    ).not.toHaveBeenCalled();
  });

  it('rejects a blank filename before opening a database connection', async () => {
    await expect(
      service.updateStock({
        filename: ' ',
        group: [{ pro_code: 'A', stock: 1 }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(
      productRepo.manager.connection.createQueryRunner,
    ).not.toHaveBeenCalled();
  });

  it('accepts numeric stock strings and passes numbers to the bulk query', async () => {
    stockOutResults.push([{ pro_code: 'B', pro_name: 'Redeem B' }]);

    await service.updateStock({
      filename: 'numeric-strings.xlsx',
      group: [
        { pro_code: 'B', stock: '0' },
        { pro_code: 'A', stock: '' },
        { pro_code: 'A', stock: '5.5' },
      ],
    });

    expect(updateBuilders[0].where).toHaveBeenCalledWith(
      'pro_code IN (:...updateCodes)',
      { updateCodes: ['A', 'B'] },
    );
    expect(updateBuilders[0].setParameters).toHaveBeenCalledWith({
      stockCode0: 'A',
      stockValue0: 5.5,
      stockCode1: 'B',
      stockValue1: 0,
    });
  });

  it('rolls back stock changes when the transactional log update fails', async () => {
    queryRunner.manager.update.mockRejectedValueOnce(new Error('log failed'));

    await expect(
      service.updateStock({
        filename: 'rollback.xlsx',
        group: [{ pro_code: 'A', stock: 4 }],
      }),
    ).rejects.toThrow('Error updating stock');

    expect(updateBuilders[0].execute).toHaveBeenCalled();
    expect(queryRunner.manager.update).toHaveBeenCalledWith(
      LogFileEntity,
      { feature: 'UpdateStock' },
      expect.objectContaining({ filename: 'rollback.xlsx' }),
    );
    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
    expect(lineSupportService.notifyRedeemStockOut).not.toHaveBeenCalled();
    expect(backendService.updateLogFile).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed stock import successful when LINE notification throws', async () => {
    stockOutResults.push([{ pro_code: 'A', pro_name: 'Redeem A' }]);
    lineSupportService.notifyRedeemStockOut.mockRejectedValueOnce(
      new Error('LINE unavailable'),
    );

    await expect(
      service.updateStock({
        filename: 'line-failure.xlsx',
        group: [{ pro_code: 'A', stock: 0 }],
      }),
    ).resolves.toBe('Stock updated successfully');

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(lineSupportService.notifyRedeemStockOut).toHaveBeenCalledTimes(1);
  });

  it('releases a connected query runner when starting the transaction fails', async () => {
    queryRunner.startTransaction.mockRejectedValueOnce(
      new Error('start failed'),
    );

    await expect(
      service.updateStock({
        filename: 'start-failure.xlsx',
        group: [{ pro_code: 'A', stock: 1 }],
      }),
    ).rejects.toThrow('Error updating stock');

    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(queryRunner.release).toHaveBeenCalledTimes(1);
    expect(queryRunner.manager.createQueryBuilder).not.toHaveBeenCalled();
  });
});
