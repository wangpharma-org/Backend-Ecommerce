import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShoppingHeadEntity } from '../shopping-head/shopping-head.entity';
import { UpsertDhlTrackingDto } from './dto/upsert-dhl-tracking.dto';
import { DhlTrackingEntity } from './dhl-tracking.entity';

export interface UpsertDhlTrackingResult {
  success: true;
  soh_running: string;
  tracking_number: string;
}

@Injectable()
export class DhlTrackingService {
  constructor(
    @InjectRepository(DhlTrackingEntity)
    private readonly dhlTrackingRepo: Repository<DhlTrackingEntity>,
    @InjectRepository(ShoppingHeadEntity)
    private readonly shoppingHeadRepo: Repository<ShoppingHeadEntity>,
  ) {}

  async upsert(
    dto: UpsertDhlTrackingDto,
  ): Promise<UpsertDhlTrackingResult> {
    const order = await this.shoppingHeadRepo.findOne({
      where: { soh_running: dto.soh_running },
      select: { soh_running: true },
    });
    if (!order) {
      throw new NotFoundException(
        `Order with soh_running ${dto.soh_running} was not found`,
      );
    }

    await this.dhlTrackingRepo.upsert(
      {
        soh_running: dto.soh_running,
        tracking_number: dto.tracking_number,
      },
      ['soh_running', 'tracking_number'],
    );

    return {
      success: true,
      soh_running: dto.soh_running,
      tracking_number: dto.tracking_number,
    };
  }
}
