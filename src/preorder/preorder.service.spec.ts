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
import { NotificationTokenEntity } from '../notifyapp/notification-token.entity';
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
  let tokenRepo: ReturnType<typeof repoMock>;
  const notifier = {
    send: jest.fn(),
    sendMany: jest.fn(),
    getLineRegisteredMemCodes: jest.fn(),
  };

  beforeEach(async () => {
    campaignRepo = repoMock();
    tokenRepo = repoMock();
    notifier.sendMany.mockReset().mockResolvedValue(0);
    notifier.getLineRegisteredMemCodes.mockReset().mockResolvedValue([]);
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
          provide: getRepositoryToken(NotificationTokenEntity),
          useValue: tokenRepo,
        },
        {
          provide: ShoppingCartService,
          useValue: { addProductCart: jest.fn() },
        },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        { provide: PreorderNotifierService, useValue: notifier },
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

  describe('notifyCampaignOpened', () => {
    const openCampaign = (over: Record<string, unknown> = {}) => ({
      id: 7,
      name: 'รอบ ต.ค.',
      status: PreorderCampaignStatus.OPEN,
      starts_at: null,
      ends_at: null,
      open_notified_at: null,
      products: [
        {
          pro_code: 'P1',
          product: { pro_nameTH: 'ยาแก้ไอ', pro_name: 'Cough' },
        },
      ],
      ...over,
    });
    const mockCampaign = (c: unknown) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(c),
      };
      campaignRepo.createQueryBuilder.mockReturnValue(qb);
    };

    it('แจ้งร้านที่ผูก LINE หรือมี FCM token ไม่ซ้ำกัน พร้อมลิงก์ไปรอบนั้น', async () => {
      mockCampaign(openCampaign());
      notifier.getLineRegisteredMemCodes.mockResolvedValue(['A', 'B']);
      tokenRepo.find.mockResolvedValue([{ mem_code: 'B' }, { mem_code: 'C' }]);
      campaignRepo.update.mockResolvedValue({ affected: 1 });
      notifier.sendMany.mockResolvedValue(3);

      await expect(service.notifyCampaignOpened(7)).resolves.toBe(3);

      const [list] = notifier.sendMany.mock.calls[0] as [
        { memCode: string; message: string; data: Record<string, unknown> }[],
      ];
      expect(list.map((n) => n.memCode)).toEqual(['A', 'B', 'C']);
      expect(list[0].message).toContain('ยาแก้ไอ');
      expect(list[0].data).toEqual({
        type: 'preorder',
        event: 'campaign_opened',
        campaign_id: 7,
        pro_code: 'P1',
        url: 'https://store.wangpharma.com/preorder?campaign=7',
      });
    });

    it('รอบหลายสินค้า: ใช้ชื่อรอบ ไม่ส่ง pro_code', async () => {
      mockCampaign(
        openCampaign({
          products: [
            { pro_code: 'P1', product: null },
            { pro_code: 'P2', product: null },
          ],
        }),
      );
      notifier.getLineRegisteredMemCodes.mockResolvedValue(['A']);
      tokenRepo.find.mockResolvedValue([]);
      campaignRepo.update.mockResolvedValue({ affected: 1 });

      await service.notifyCampaignOpened(7);

      const [list] = notifier.sendMany.mock.calls[0] as [
        { message: string; data: Record<string, unknown> }[],
      ];
      expect(list[0].message).toContain('รอบ "รอบ ต.ค." 2 รายการ');
      expect(list[0].data).not.toHaveProperty('pro_code');
    });

    it('starts_at ยังไม่ถึง / แจ้งไปแล้ว / ยังไม่มีสินค้า → ไม่แจ้งและไม่ claim', async () => {
      for (const over of [
        { starts_at: new Date(Date.now() + 3600 * 1000) },
        { open_notified_at: new Date() },
        { products: [] },
      ]) {
        mockCampaign(openCampaign(over));
        await expect(service.notifyCampaignOpened(7)).resolves.toBe(0);
      }
      expect(campaignRepo.update).not.toHaveBeenCalled();
      expect(notifier.sendMany).not.toHaveBeenCalled();
    });

    it('notification-service ล่มตอนดึงรายชื่อ LINE → ไม่ claim เพื่อให้ cron ลองใหม่', async () => {
      mockCampaign(openCampaign());
      notifier.getLineRegisteredMemCodes.mockRejectedValue(new Error('down'));
      tokenRepo.find.mockResolvedValue([{ mem_code: 'C' }]);

      await expect(service.notifyCampaignOpened(7)).resolves.toBe(0);
      expect(campaignRepo.update).not.toHaveBeenCalled();
      expect(notifier.sendMany).not.toHaveBeenCalled();
    });

    it('instance อื่น claim ไปก่อน → ไม่ส่งซ้ำ', async () => {
      mockCampaign(openCampaign());
      tokenRepo.find.mockResolvedValue([{ mem_code: 'C' }]);
      campaignRepo.update.mockResolvedValue({ affected: 0 });

      await expect(service.notifyCampaignOpened(7)).resolves.toBe(0);
      expect(notifier.sendMany).not.toHaveBeenCalled();
    });
  });
});
