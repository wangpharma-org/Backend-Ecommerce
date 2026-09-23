import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { OrderBillNumberEntity } from './order-bill-number.entity';
import { OrderBillNumberService } from './order-bill-number.service';

describe('OrderBillNumberService (ECWC-559)', () => {
  let service: OrderBillNumberService;
  let billNumberRepo: { upsert: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    billNumberRepo = {
      upsert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderBillNumberService,
        {
          provide: getRepositoryToken(OrderBillNumberEntity),
          useValue: billNumberRepo,
        },
      ],
    }).compile();

    service = module.get<OrderBillNumberService>(OrderBillNumberService);
  });

  it('stores the bill number against sh_running, overwriting the old one', async () => {
    await expect(
      service.upsert({ sh_running: 'SO-001', bill_number: 'IV-001' }),
    ).resolves.toEqual({
      success: true,
      sh_running: 'SO-001',
      bill_number: 'IV-001',
    });
    expect(billNumberRepo.upsert).toHaveBeenCalledWith(
      { soh_running: 'SO-001', bill_number: 'IV-001' },
      ['soh_running'],
    );
  });

  it('returns the stored bill number', async () => {
    billNumberRepo.findOne.mockResolvedValue({
      soh_running: 'SO-001',
      bill_number: 'IV-001',
    });
    await expect(service.findBySohRunning('SO-001')).resolves.toBe('IV-001');
  });

  it('returns null when no bill number was sent yet', async () => {
    billNumberRepo.findOne.mockResolvedValue(null);
    await expect(service.findBySohRunning('SO-404')).resolves.toBeNull();
  });
});
