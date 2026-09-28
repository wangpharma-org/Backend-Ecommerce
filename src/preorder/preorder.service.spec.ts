import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PreorderService } from './preorder.service';
import {
  PreorderCampaignEntity,
  PreorderCampaignStatus,
} from './preorder-campaign.entity';
import { PreorderProductEntity } from './preorder-product.entity';
import { PreorderItemEntity } from './preorder-item.entity';
import { PreorderItemLogEntity } from './preorder-item-log.entity';
import { PreorderNotifierService } from './preorder-notifier.service';
import { ProductEntity } from '../products/products.entity';
import { UserEntity } from '../users/users.entity';
import { ShoppingCartService } from '../shopping-cart/shopping-cart.service';

const repoMock = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  save: jest.fn((x) => Promise.resolve(x)),
  create: jest.fn((x: unknown) => x),
  count: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
  manager: {},
});

describe('PreorderService', () => {
  let service: PreorderService;
  let campaignRepo: ReturnType<typeof repoMock>;

  beforeEach(async () => {
    campaignRepo = repoMock();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreorderService,
        {
          provide: getRepositoryToken(PreorderCampaignEntity),
          useValue: campaignRepo,
        },
        {
          provide: getRepositoryToken(PreorderProductEntity),
          useValue: repoMock(),
        },
        {
          provide: getRepositoryToken(PreorderItemEntity),
          useValue: repoMock(),
        },
        {
          provide: getRepositoryToken(PreorderItemLogEntity),
          useValue: repoMock(),
        },
        { provide: getRepositoryToken(ProductEntity), useValue: repoMock() },
        { provide: getRepositoryToken(UserEntity), useValue: repoMock() },
        {
          provide: ShoppingCartService,
          useValue: { addProductCart: jest.fn() },
        },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: PreorderNotifierService,
          useValue: {
            send: jest.fn(),
            sendMany: jest.fn().mockResolvedValue(0),
          },
        },
      ],
    }).compile();
    service = module.get(PreorderService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('upsertItem: amount ต้องเป็นจำนวนเต็ม >= 1', async () => {
    const actor = { mem_code: 'M001' };
    await expect(
      service.upsertItem(actor, 1, 'P1', { amount: 0 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upsertItem(actor, 1, 'P1', { amount: 1.5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.upsertItem(actor, 1, 'P1', { amount: '2a' as unknown as number }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('upsertItem: ไม่มี mem_code ใน token → Forbidden', async () => {
    await expect(
      service.upsertItem({ mem_code: '' }, 1, 'P1', { amount: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createCampaign: ต้องมีชื่อ', async () => {
    campaignRepo.create.mockImplementation((x: unknown) => x);
    await expect(
      service.createCampaign({ mem_code: 'A' }, { name: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('createCampaign: ends_at ต้องหลัง starts_at', async () => {
    campaignRepo.create.mockImplementation((x: unknown) => x);
    await expect(
      service.createCampaign(
        { mem_code: 'A' },
        { name: 'x', starts_at: '2026-10-01', ends_at: '2026-09-01' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('setCampaignStatus: draft → allocating ไม่ได้', async () => {
    campaignRepo.findOne.mockResolvedValue({
      id: 1,
      status: PreorderCampaignStatus.DRAFT,
    });
    await expect(
      service.setCampaignStatus(1, PreorderCampaignStatus.ALLOCATING),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
