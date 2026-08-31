import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ProductEntity } from 'src/products/products.entity';
import { RedeemProductBackupEntity } from './redeem-product-backup.entity';
import { RedeemProductSetService } from './redeem-product-set.service';
import { RedeemSettingsEntity } from './redeem-settings.entity';

const createProduct = (values: {
  pro_code: string;
  pro_point: number;
  pro_stock: number;
  pro_free?: boolean;
  pro_redeem_display_quantity?: number | null;
  pro_redeem_hidden?: boolean;
  pro_redeem_coming_soon?: boolean;
}): ProductEntity =>
  Object.assign(new ProductEntity(), {
    pro_free: true,
    pro_redeem_display_quantity: null,
    pro_redeem_hidden: false,
    pro_redeem_coming_soon: false,
    pro_redeem_rank: null,
    pro_supplier: '01',
    units: [],
    ...values,
  });

describe('RedeemProductSetService', () => {
  const productRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const settingsRepository = { findOne: jest.fn(), save: jest.fn() };
  const backupRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    delete: jest.fn(),
  };
  let service: RedeemProductSetService;

  beforeEach(async () => {
    jest.clearAllMocks();
    settingsRepository.findOne.mockResolvedValue({ displayLimit: 50 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RedeemProductSetService,
        {
          provide: getRepositoryToken(ProductEntity),
          useValue: productRepository,
        },
        {
          provide: getRepositoryToken(RedeemSettingsEntity),
          useValue: settingsRepository,
        },
        {
          provide: getRepositoryToken(RedeemProductBackupEntity),
          useValue: backupRepository,
        },
      ],
    }).compile();

    service = module.get<RedeemProductSetService>(RedeemProductSetService);
  });

  it('shows Coming Soon main product instead of an available backup', async () => {
    const main = createProduct({
      pro_code: 'MAIN',
      pro_point: 100,
      pro_stock: 10,
      pro_redeem_hidden: true,
      pro_redeem_coming_soon: true,
    });
    const backup = createProduct({
      pro_code: 'BACKUP',
      pro_point: 0,
      pro_stock: 10,
    });
    productRepository.find
      .mockResolvedValueOnce([main])
      .mockResolvedValueOnce([backup]);
    backupRepository.find.mockResolvedValue([
      { redeemProductCode: 'MAIN', backupProductCode: 'BACKUP' },
    ]);

    await expect(service.getCustomerSet()).resolves.toEqual([
      expect.objectContaining({
        redeemProduct: main,
        displayProduct: main,
        displayQuantity: 0,
        isComingSoon: true,
      }),
    ]);
  });

  it('shows the available backup when the non-Coming-Soon main product is out of stock', async () => {
    const main = createProduct({
      pro_code: 'MAIN',
      pro_point: 100,
      pro_stock: 0,
    });
    const backup = createProduct({
      pro_code: 'BACKUP',
      pro_point: 0,
      pro_stock: 3,
    });
    productRepository.find
      .mockResolvedValueOnce([main])
      .mockResolvedValueOnce([backup]);
    backupRepository.find.mockResolvedValue([
      { redeemProductCode: 'MAIN', backupProductCode: 'BACKUP' },
    ]);

    await expect(service.getCustomerSet()).resolves.toEqual([
      expect.objectContaining({
        redeemProduct: main,
        displayProduct: backup,
        displayQuantity: 3,
        isComingSoon: false,
      }),
    ]);
  });

  it('returns to the main product as soon as its stock is available again', async () => {
    const main = createProduct({
      pro_code: 'MAIN',
      pro_point: 100,
      pro_stock: 4,
    });
    const backup = createProduct({
      pro_code: 'BACKUP',
      pro_point: 0,
      pro_stock: 3,
    });
    productRepository.find
      .mockResolvedValueOnce([main])
      .mockResolvedValueOnce([backup]);
    backupRepository.find.mockResolvedValue([
      { redeemProductCode: 'MAIN', backupProductCode: 'BACKUP' },
    ]);

    await expect(service.getCustomerSet()).resolves.toEqual([
      expect.objectContaining({
        redeemProduct: main,
        displayProduct: main,
        displayQuantity: 4,
        isComingSoon: false,
      }),
    ]);
  });

  it('rejects a backup product already assigned to another main product', async () => {
    const main = createProduct({
      pro_code: 'MAIN',
      pro_point: 100,
      pro_stock: 1,
    });
    const backup = createProduct({
      pro_code: 'BACKUP',
      pro_point: 0,
      pro_stock: 1,
    });
    productRepository.findOne
      .mockResolvedValueOnce(main)
      .mockResolvedValueOnce(backup);
    backupRepository.findOne.mockResolvedValue({
      redeemProductCode: 'OTHER_MAIN',
      backupProductCode: 'BACKUP',
    });

    await expect(service.setBackup('MAIN', 'BACKUP')).rejects.toThrow(
      'สินค้าสำรองนี้ถูกกำหนดให้สินค้าหลักรายการอื่นแล้ว',
    );
  });
});
