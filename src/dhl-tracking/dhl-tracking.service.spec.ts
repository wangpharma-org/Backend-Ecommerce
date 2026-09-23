import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { DhlTrackingEntity } from './dhl-tracking.entity';
import { DhlTrackingService } from './dhl-tracking.service';

describe('DhlTrackingService', () => {
  let service: DhlTrackingService;
  let dhlTrackingRepo: { upsert: jest.Mock };
  let shoppingHeadRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    dhlTrackingRepo = { upsert: jest.fn().mockResolvedValue(undefined) };
    shoppingHeadRepo = { findOne: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DhlTrackingService,
        {
          provide: getRepositoryToken(DhlTrackingEntity),
          useValue: dhlTrackingRepo,
        },
        {
          provide: getRepositoryToken(ShoppingHeadEntity),
          useValue: shoppingHeadRepo,
        },
      ],
    }).compile();

    service = module.get<DhlTrackingService>(DhlTrackingService);
  });

  it('stores the DHL number against an existing order', async () => {
    shoppingHeadRepo.findOne.mockResolvedValue({ soh_running: 'SO-001' });

    await expect(
      service.upsert({
        soh_running: 'SO-001',
        tracking_number: '7128083062012186',
      }),
    ).resolves.toEqual({
      success: true,
      soh_running: 'SO-001',
      tracking_number: '7128083062012186',
    });
    expect(dhlTrackingRepo.upsert).toHaveBeenCalledWith(
      {
        soh_running: 'SO-001',
        tracking_number: '7128083062012186',
      },
      ['soh_running', 'tracking_number'],
    );
  });

  it('does not store a DHL number for an unknown order', async () => {
    shoppingHeadRepo.findOne.mockResolvedValue(null);

    await expect(
      service.upsert({
        soh_running: 'SO-404',
        tracking_number: '7128083062012186',
      }),
    ).rejects.toThrow(NotFoundException);
    expect(dhlTrackingRepo.upsert).not.toHaveBeenCalled();
  });
});
